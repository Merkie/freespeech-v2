import { createSignal } from 'solid-js';
import api from './api';
import { cacheBlob, getCachedBlobEntry, getDirtyBlobIds, reconcileCachedBlobAfterSync } from './cache/blob-cache';
import { MODAL_ID } from './constants';
import {
	conflictServerBlob,
	projectBlob,
	setActiveModalId,
	setConflictServerBlob,
	setProjectBlob,
	setSyncStatus,
	syncStatus,
} from './state';
import type { ProjectBlob } from './types';

// --- Background Sync registration ---
async function requestBackgroundSync() {
	try {
		const reg = await navigator.serviceWorker?.ready;
		if (reg && 'sync' in reg) {
			await (reg as any).sync.register('sync-dirty-blobs');
		}
	} catch {
		// Background Sync not supported or failed — non-critical
	}
}

// --- Debounce timer ---
let syncTimer: ReturnType<typeof setTimeout> | null = null;
const SYNC_DEBOUNCE_MS = 2000;

// --- Edit mode state ---
let editModeActive = false;
let editModeSnapshot: ProjectBlob | null = null;
export const [editModeHasChanges, setEditModeHasChanges] = createSignal(false);

export function enterEditMode(): void {
	const current = projectBlob();
	if (!current) return;
	editModeSnapshot = structuredClone(current);
	editModeActive = true;
	setEditModeHasChanges(false);
}

export async function saveEditMode(): Promise<void> {
	const blob = projectBlob();
	if (!blob) return;

	// IndexedDB is the durability boundary. Wait for it before callers navigate or reload; the
	// server sync can continue in the background after the edit-mode UI closes.
	await cacheBlob(blob, true);
	editModeActive = false;
	editModeSnapshot = null;
	setEditModeHasChanges(false);
	setSyncStatus('dirty');
	void forceSyncNow().catch((err) => console.error('Sync failed:', err));
}

export function discardEditMode(): void {
	editModeActive = false;
	setEditModeHasChanges(false);

	if (editModeSnapshot) {
		setProjectBlob(editModeSnapshot);
	}
	editModeSnapshot = null;
}

export function hasUnsavedEditChanges(): boolean {
	return editModeActive && editModeHasChanges();
}

/** Makes the current board durable before an in-app update reloads the page. */
export async function prepareForAppReload(): Promise<boolean> {
	if (hasUnsavedEditChanges()) return false;

	const blob = projectBlob();
	if (blob && syncStatus() !== 'synced') {
		// A fresh revision prevents an older in-flight response from marking this snapshot clean.
		await cacheBlob(blob, true);
	}

	return true;
}

// --- Load project blob ---
// Returns true if loaded successfully (from cache or server)
export async function loadProjectBlob(projectId: string): Promise<boolean> {
	// 1. Try IndexedDB cache first for instant render
	const cachedEntry = await getCachedBlobEntry(projectId);
	const cached = cachedEntry?.blob ?? null;
	if (cached) {
		setProjectBlob(cached);
	}

	// A dirty local blob is the newest copy we know about. Never replace it with a server GET on
	// cold start; sync it first so the normal conflict flow can decide if another device also edited.
	if (cachedEntry?.dirty) {
		setSyncStatus(navigator.onLine ? 'dirty' : 'offline');
		if (navigator.onLine) void syncBlobToServer().catch((err) => console.error('Sync failed:', err));
		return true;
	}

	// 2. Fetch from server
	try {
		const { blob, error } = await api.project.fetchBlob(projectId);
		if (error || !blob) {
			// If we had a cached version, keep using it
			if (cached) return true;
			return false;
		}

		setProjectBlob(blob);
		await cacheBlob(blob, false);
		return true;
	} catch {
		// Network error — use cache if available
		if (cached) {
			setSyncStatus('offline');
			return true;
		}
		return false;
	}
}

// --- The single mutation pathway ---
export function mutateBlob(mutator: (blob: ProjectBlob) => void): void {
	const current = projectBlob();
	if (!current) return;

	const clone = structuredClone(current);
	mutator(clone);

	// Update in-memory signal (instant UI update)
	setProjectBlob(clone);

	// In edit mode: skip cache and server sync — changes are held in memory only
	if (editModeActive) {
		setEditModeHasChanges(true);
		return;
	}

	// Persist to IndexedDB (dirty)
	cacheBlob(clone, true)
		.then(() => {
			if (!navigator.onLine) return requestBackgroundSync();
		})
		.catch((err) => console.error('Failed to cache blob:', err));

	// Update sync status
	setSyncStatus('dirty');

	// Debounce server sync
	if (syncTimer) clearTimeout(syncTimer);
	syncTimer = setTimeout(() => {
		syncBlobToServer().catch((err) => console.error('Sync failed:', err));
	}, SYNC_DEBOUNCE_MS);
}

// --- Push local blob to server ---
let syncRequested = false;
let syncLoopPromise: Promise<boolean> | null = null;

async function syncLatestBlobOnce(): Promise<boolean> {
	const blob = projectBlob();
	if (!blob) return false;

	// Persist exactly what this request is about and remember its revision. If another edit lands
	// while the request is in flight, reconciliation keeps that newer revision dirty.
	const revision = await cacheBlob(blob, true);
	if (projectBlob() !== blob) {
		syncRequested = true;
		setSyncStatus('dirty');
		return true;
	}

	setSyncStatus('syncing');

	try {
		const result = await api.project.syncBlob(blob.id, blob, blob.lastEditedAt);

		if (result.error && result.serverBlob) {
			// 409 conflict
			setConflictServerBlob(result.serverBlob);
			setSyncStatus('conflict');
			setActiveModalId(MODAL_ID.SYNC_CONFLICT);
			return false;
		}

		if (result.error) {
			setSyncStatus('error');
			return false;
		}

		if (!result.lastEditedAt) {
			setSyncStatus('error');
			return false;
		}

		const reconciliation = await reconcileCachedBlobAfterSync(blob.id, revision, result.lastEditedAt);
		const current = projectBlob();

		if (current?.id === blob.id && current !== blob) {
			// The request saved blob A while the user created blob B. Rebase B onto A's server timestamp,
			// persist it as dirty, and immediately drain one more sync instead of rolling the UI back.
			const rebased = { ...current, lastEditedAt: result.lastEditedAt };
			setProjectBlob(rebased);
			await cacheBlob(rebased, true);
			setSyncStatus('dirty');
			syncRequested = true;
		} else if (current === blob && reconciliation?.needsAnotherSync) {
			// A newer IndexedDB revision landed while this request was in flight. Adopt it rather than
			// overwriting it with the request's older snapshot.
			setProjectBlob(reconciliation.entry.blob);
			setSyncStatus('dirty');
			syncRequested = true;
		} else if (current === blob) {
			setProjectBlob({ ...blob, lastEditedAt: result.lastEditedAt });
			setSyncStatus('synced');
		}

		return true;
	} catch {
		// Network error — register for background sync retry
		requestBackgroundSync();
		setSyncStatus('offline');
		return false;
	}
}

async function drainRequestedSyncs(): Promise<boolean> {
	let result = true;
	do {
		syncRequested = false;
		result = await syncLatestBlobOnce();
	} while (result && syncRequested);
	return result;
}

export function syncBlobToServer(): Promise<boolean> {
	syncRequested = true;
	if (!syncLoopPromise) {
		syncLoopPromise = drainRequestedSyncs();
		void syncLoopPromise
			.finally(() => {
				syncLoopPromise = null;
			})
			.catch(() => undefined);
	}
	return syncLoopPromise;
}

// --- Background revalidation ---
export async function checkAndRevalidate(projectId: string): Promise<void> {
	try {
		if ((await getCachedBlobEntry(projectId))?.dirty) return;
		const beforeRequest = projectBlob();
		const { lastEditedAt } = await api.project.syncCheck(projectId);
		const current = projectBlob();

		if (current === beforeRequest && current && lastEditedAt && lastEditedAt > current.lastEditedAt) {
			// Server has newer data — re-download blob
			const { blob } = await api.project.fetchBlob(projectId);
			if (blob && projectBlob() === current && !(await getCachedBlobEntry(projectId))?.dirty) {
				setProjectBlob(blob);
				await cacheBlob(blob, false);
			}
		}
	} catch {
		// Network error — ignore, we have cached data
	}
}

// --- Flush all dirty blobs (called on reconnect) ---
export async function flushDirtyBlobs(): Promise<void> {
	const dirtyIds = await getDirtyBlobIds();
	for (const id of dirtyIds) {
		if (projectBlob()?.id === id) {
			await syncBlobToServer();
			continue;
		}

		const cachedEntry = await getCachedBlobEntry(id);
		if (!cachedEntry) continue;

		try {
			// Reconnect is not permission to overwrite another device. A 409 stays dirty until the
			// project is opened and the existing conflict modal can ask the user what to keep.
			const result = await api.project.syncBlob(id, cachedEntry.blob, cachedEntry.blob.lastEditedAt);
			if (result.success && result.lastEditedAt) {
				await reconcileCachedBlobAfterSync(id, cachedEntry.revision ?? 0, result.lastEditedAt);
			}
		} catch {
			// Still offline — leave dirty
		}
	}
}

// Force sync immediately (cancel debounce)
export async function forceSyncNow(): Promise<boolean> {
	if (syncTimer) {
		clearTimeout(syncTimer);
		syncTimer = null;
	}
	return syncBlobToServer();
}

// --- Conflict resolution ---
export async function resolveConflictKeepLocal(): Promise<void> {
	const blob = projectBlob();
	if (!blob) return;

	setConflictServerBlob(null);
	setActiveModalId('');
	setSyncStatus('syncing');

	try {
		const revision = await cacheBlob(blob, true);
		const result = await api.project.syncBlob(blob.id, blob, blob.lastEditedAt, true);
		if (result.lastEditedAt) {
			const reconciliation = await reconcileCachedBlobAfterSync(blob.id, revision, result.lastEditedAt);
			const current = projectBlob();
			if (current === blob && !reconciliation?.needsAnotherSync) {
				setProjectBlob({ ...blob, lastEditedAt: result.lastEditedAt });
				setSyncStatus('synced');
			} else if (current?.id === blob.id) {
				const rebased = { ...current, lastEditedAt: result.lastEditedAt };
				setProjectBlob(rebased);
				await cacheBlob(rebased, true);
				setSyncStatus('dirty');
				void syncBlobToServer().catch((err) => console.error('Sync failed:', err));
			}
		} else {
			setSyncStatus('error');
		}
	} catch {
		setSyncStatus('error');
	}
}

export async function resolveConflictUseServer(): Promise<void> {
	const server = conflictServerBlob();
	if (!server) return;

	setProjectBlob(server);
	await cacheBlob(server, false);
	setConflictServerBlob(null);
	setActiveModalId('');
	setSyncStatus('synced');
}
