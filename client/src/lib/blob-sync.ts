import { createSignal } from 'solid-js';
import api from './api';
import {
	cacheBlob,
	cacheDraft,
	cacheRemoteBlob,
	getCachedBlobEntry,
	getDirtyBlobIds,
	reconcileCachedBlobAfterSync,
} from './cache/blob-cache';
import { MODAL_ID } from './constants';
import {
	conflictServerBlob,
	projectBlob,
	setActiveModalId,
	setConflictServerBlob,
	setProjectBlob,
	setSyncStatus,
} from './state';
import type { ProjectBlob } from './types';

let editModeActive = false;
let editModeSnapshot: ProjectBlob | null = null;
let generation = 0;
let syncTimer: ReturnType<typeof setTimeout> | undefined;
let writes: Promise<unknown> = Promise.resolve();
const syncs = new Map<string, Promise<boolean>>();
const acknowledgedVersions = new Map<string, { from: string; to: string }>();
function rebaseOwnSave(blob: ProjectBlob): ProjectBlob {
	const version = acknowledgedVersions.get(blob.id);
	return version?.from === blob.lastEditedAt ? { ...blob, lastEditedAt: version.to } : blob;
}
export const [editModeHasChanges, setEditModeHasChanges] = createSignal(false);
export const [draftRecovered, setDraftRecovered] = createSignal(false);
export const [storageError, setStorageError] = createSignal(false);

// Serialize writes so Save/Discard cannot be overtaken by an earlier draft write.
function persist<T>(action: () => Promise<T>): Promise<T> {
	const epoch = generation;
	const next = writes
		.catch(() => undefined)
		.then(() => {
			if (epoch !== generation) throw new Error('Session changed');
			return action();
		});
	writes = next;
	void next.then(
		() => setStorageError(false),
		() => setStorageError(true),
	);
	return next;
}

async function requestBackgroundSync() {
	try {
		const reg = await navigator.serviceWorker?.ready;
		if (reg && 'sync' in reg) await (reg as any).sync.register('sync-dirty-blobs');
	} catch {
		/* Optional on platforms without Background Sync. */
	}
}

export async function resetBlobSession() {
	generation++;
	clearTimeout(syncTimer);
	exitEditModeAfterExternalUpdate();
	await writes.catch(() => undefined);
	syncs.clear();
	acknowledgedVersions.clear();
	setStorageError(false);
}

export async function enterEditMode(): Promise<boolean> {
	const current = projectBlob();
	if (!current) return false;
	await writes.catch(() => undefined);
	const entry = await getCachedBlobEntry(current.id);
	if (projectBlob()?.id !== current.id) return false;
	if (!entry) await cacheBlob(current);
	editModeSnapshot = entry?.blob ?? current;
	editModeActive = true;
	setDraftRecovered(!!entry?.draft);
	setEditModeHasChanges(!!entry?.draft);
	if (entry?.draft) setProjectBlob(entry.draft);
	return true;
}

export async function saveEditMode(): Promise<void> {
	const blob = projectBlob();
	if (!blob) return;
	await persist(() => cacheBlob(rebaseOwnSave(blob), true, true));
	exitEditModeAfterExternalUpdate();
	setSyncStatus('dirty');
	void forceSyncNow();
}

export async function discardEditMode(): Promise<void> {
	const snapshot = editModeSnapshot;
	if (snapshot) {
		await persist(() => cacheDraft(snapshot.id));
		if (projectBlob()?.id === snapshot.id) setProjectBlob(rebaseOwnSave(snapshot));
	}
	exitEditModeAfterExternalUpdate();
}

export function exitEditModeAfterExternalUpdate(): void {
	editModeActive = false;
	editModeSnapshot = null;
	setEditModeHasChanges(false);
	setDraftRecovered(false);
}

export function hasUnsavedEditChanges(): boolean {
	return editModeActive && editModeHasChanges();
}

export async function prepareForAppReload(): Promise<boolean> {
	if (hasUnsavedEditChanges()) return false;
	await writes.catch(() => undefined);
	return !storageError();
}

export async function loadProjectBlob(projectId: string, isCurrent = () => true): Promise<boolean> {
	const epoch = generation;
	const valid = () => epoch === generation && isCurrent();
	const cached = await getCachedBlobEntry(projectId).catch(() => null);
	if (!valid()) return false;
	if (cached) {
		setProjectBlob(cached.blob);
		setSyncStatus(navigator.onLine ? (cached.dirty ? 'dirty' : 'synced') : 'offline');
		// The caller can render now. Revalidation has no place on the cached startup path.
		return true;
	}
	try {
		const { blob, error, etag } = await api.project.fetchBlob(projectId);
		if (!valid() || error || !blob) return false;
		const stored = await cacheRemoteBlob(blob, 0, etag).catch(() => {
			setStorageError(true);
			return undefined;
		});
		const newer = stored === false ? await getCachedBlobEntry(projectId) : null;
		if (!valid()) return false;
		setProjectBlob(newer?.blob ?? blob);
		if (newer?.dirty) setSyncStatus('dirty');
		return true;
	} catch {
		return false;
	}
}

export function mutateBlob(mutator: (blob: ProjectBlob) => void): void {
	const current = projectBlob();
	if (!current) return;
	const clone = structuredClone(current);
	mutator(clone);
	setProjectBlob(clone);
	if (editModeActive) {
		setEditModeHasChanges(true);
		void persist(() => cacheDraft(clone.id, rebaseOwnSave(clone))).catch(() => undefined);
		return;
	}
	setSyncStatus('dirty');
	void persist(() => cacheBlob(rebaseOwnSave(clone), true))
		.then(() => {
			clearTimeout(syncTimer);
			syncTimer = setTimeout(() => void flushDirtyBlobs(), 2000);
			if (!navigator.onLine) void requestBackgroundSync();
		})
		.catch(() => undefined);
}

async function syncProject(id: string, force = false): Promise<boolean> {
	const existing = syncs.get(id);
	if (existing) return existing;
	const epoch = generation;
	const token = localStorage.getItem('token');
	const valid = () => epoch === generation && token === localStorage.getItem('token');
	const active = () => valid() && projectBlob()?.id === id;
	const run = async () => {
		for (let attempt = 0; attempt < 10; attempt++) {
			await writes.catch(() => undefined);
			if (!valid()) return false;
			const entry = await getCachedBlobEntry(id);
			if (!entry?.dirty) return true;
			if (active()) setSyncStatus('syncing');
			// Only the committed IndexedDB copy is ever sent. An open editor may contain a draft.
			const result = await api.project.syncBlob(id, entry.blob, entry.blob.lastEditedAt, force);
			force = false;
			if (!valid()) return false;
			if (result.serverBlob) {
				if (active()) {
					setConflictServerBlob(result.serverBlob);
					setSyncStatus('conflict');
					// Let an open editor finish Save/Discard before asking which committed copy to keep.
					if (!editModeActive) setActiveModalId(MODAL_ID.SYNC_CONFLICT);
				}
				return false;
			}
			if (result.error || !result.lastEditedAt) {
				if (active()) setSyncStatus('error');
				return false;
			}
			const version = result.lastEditedAt;
			acknowledgedVersions.set(id, { from: entry.blob.lastEditedAt, to: version });
			await persist(async () => {
				const reconciliation = await reconcileCachedBlobAfterSync(id, entry.revision, version);
				if (!active() || !reconciliation) return;
				const current = projectBlob();
				// Rebase our own changes without copying an unsaved editor into the committed store.
				if (current?.lastEditedAt === entry.blob.lastEditedAt) setProjectBlob({ ...current, lastEditedAt: version });
				if (editModeSnapshot?.id === id && editModeSnapshot.lastEditedAt === entry.blob.lastEditedAt) {
					editModeSnapshot = { ...editModeSnapshot, lastEditedAt: version };
				}
				setSyncStatus(reconciliation.needsAnotherSync ? 'dirty' : 'synced');
			});
		}
		return true;
	};
	const promise = run()
		.catch(() => {
			if (active()) setSyncStatus(navigator.onLine ? 'error' : 'offline');
			void requestBackgroundSync();
			return false;
		})
		.finally(() => {
			if (syncs.get(id) === promise) syncs.delete(id);
		});
	syncs.set(id, promise);
	return promise;
}

export function syncBlobToServer(): Promise<boolean> {
	const id = projectBlob()?.id;
	return id ? syncProject(id) : Promise.resolve(false);
}

export async function checkAndRevalidate(projectId: string): Promise<boolean> {
	const epoch = generation;
	const token = localStorage.getItem('token');
	try {
		await writes.catch(() => undefined);
		if (editModeActive || projectBlob()?.id !== projectId) return false;
		const entry = await getCachedBlobEntry(projectId);
		if (
			epoch !== generation ||
			token !== localStorage.getItem('token') ||
			projectBlob()?.id !== projectId ||
			editModeActive
		)
			return false;
		if (entry?.dirty) {
			await syncProject(projectId);
			return false;
		}
		const before = projectBlob();
		// Another tab or the closed-app worker may already have advanced the device copy.
		if (
			entry &&
			before &&
			(entry.blob.lastEditedAt !== before.lastEditedAt || entry.blob.imageUrl !== before.imageUrl)
		) {
			setProjectBlob(entry.blob);
			setSyncStatus('synced');
			return true;
		}
		const { blob, etag } = await api.project.fetchBlob(projectId, entry?.etag);
		if (
			!blob ||
			generation !== epoch ||
			token !== localStorage.getItem('token') ||
			projectBlob() !== before ||
			editModeActive
		)
			return false;
		if (!(await cacheRemoteBlob(blob, entry?.revision ?? 0, etag))) return false;
		if (projectBlob() !== before || editModeActive || generation !== epoch) return false;
		setProjectBlob(blob);
		setSyncStatus('synced');
		return true;
	} catch {
		return false;
	}
}

export async function flushDirtyBlobs(): Promise<void> {
	await writes.catch(() => undefined);
	for (const id of await getDirtyBlobIds()) await syncProject(id);
}

export async function forceSyncNow(): Promise<boolean> {
	clearTimeout(syncTimer);
	return syncBlobToServer();
}

export async function resolveConflictKeepLocal(): Promise<void> {
	const id = projectBlob()?.id;
	if (!id || editModeActive) return;
	setActiveModalId('');
	setConflictServerBlob(null);
	await syncProject(id, true);
}

export async function resolveConflictUseServer(): Promise<void> {
	const server = conflictServerBlob();
	if (!server || projectBlob()?.id !== server.id || editModeActive) return;
	await persist(() => cacheBlob(server, false));
	setProjectBlob(server);
	setConflictServerBlob(null);
	setActiveModalId('');
	setSyncStatus('synced');
}
