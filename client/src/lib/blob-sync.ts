import api from './api';
import { cacheBlob, getCachedBlob, getDirtyBlobIds, markBlobClean } from './cache/blob-cache';
import { projectBlob, setProjectBlob, setSyncStatus } from './state';
import type { ProjectBlob } from './types';

// --- Debounce timer ---
let syncTimer: ReturnType<typeof setTimeout> | null = null;
const SYNC_DEBOUNCE_MS = 2000;

// --- Load project blob ---
// Returns true if loaded successfully (from cache or server)
export async function loadProjectBlob(projectId: string): Promise<boolean> {
	// 1. Try IndexedDB cache first for instant render
	const cached = await getCachedBlob(projectId);
	if (cached) {
		setProjectBlob(cached);
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

	// Update in-memory signal
	setProjectBlob(clone);

	// Persist to IndexedDB (dirty)
	cacheBlob(clone, true).catch((err) => console.error('Failed to cache blob:', err));

	// Update sync status
	setSyncStatus('dirty');

	// Debounce server sync
	if (syncTimer) clearTimeout(syncTimer);
	syncTimer = setTimeout(() => {
		syncBlobToServer().catch((err) => console.error('Sync failed:', err));
	}, SYNC_DEBOUNCE_MS);
}

// --- Push local blob to server ---
export async function syncBlobToServer(): Promise<boolean> {
	const blob = projectBlob();
	if (!blob) return false;

	setSyncStatus('syncing');

	try {
		const result = await api.project.syncBlob(blob.id, blob, blob.lastEditedAt);

		if (result.error && result.serverBlob) {
			// 409 conflict
			setSyncStatus('conflict');
			return false;
		}

		if (result.error) {
			setSyncStatus('error');
			return false;
		}

		// Success — update lastEditedAt and mark clean
		if (result.lastEditedAt) {
			const updated = { ...blob, lastEditedAt: result.lastEditedAt };
			setProjectBlob(updated);
			await cacheBlob(updated, false);
		} else {
			await markBlobClean(blob.id);
		}

		setSyncStatus('synced');
		return true;
	} catch {
		// Network error
		setSyncStatus('offline');
		return false;
	}
}

// --- Background revalidation ---
export async function checkAndRevalidate(projectId: string): Promise<void> {
	try {
		const { lastEditedAt } = await api.project.syncCheck(projectId);
		const current = projectBlob();

		if (current && lastEditedAt && lastEditedAt > current.lastEditedAt) {
			// Server has newer data — re-download blob
			const { blob } = await api.project.fetchBlob(projectId);
			if (blob) {
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
		const cached = await getCachedBlob(id);
		if (!cached) continue;

		try {
			const result = await api.project.syncBlob(id, cached, cached.lastEditedAt, true);
			if (result.success && result.lastEditedAt) {
				const updated = { ...cached, lastEditedAt: result.lastEditedAt };
				await cacheBlob(updated, false);

				// If this is the currently loaded project, update in-memory
				const current = projectBlob();
				if (current?.id === id) {
					setProjectBlob(updated);
					setSyncStatus('synced');
				}
			} else {
				await markBlobClean(id);
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
