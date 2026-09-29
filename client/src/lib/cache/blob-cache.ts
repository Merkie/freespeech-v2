import { reconcileSuccessfulSync, type SyncReconciliation } from '../sync-reconcile';
import type { Project, ProjectBlob } from '../types';
import { getDB } from './db';

export async function getCachedBlobEntry(projectId: string) {
	const db = await getDB();
	const entry = await db.get('projectBlobs', projectId);
	return entry ? { ...entry, revision: entry.revision ?? 0 } : null;
}

export async function getCachedBlob(projectId: string): Promise<ProjectBlob | null> {
	const entry = await getCachedBlobEntry(projectId);
	return entry?.blob ?? null;
}

/**
 * Builds dashboard-safe summaries from the blobs that are genuinely available offline. A blob
 * does not carry server-only fields such as favourite/public state, so those use neutral defaults
 * until the online project list can be reached again.
 */
export async function getCachedProjects(): Promise<Project[]> {
	const db = await getDB();
	const entries = await db.getAll('projectBlobs');

	return entries.map(({ blob }) => ({
		id: blob.id,
		userId: '',
		name: blob.name,
		description: blob.description,
		imageUrl: blob.imageUrl,
		columns: blob.columns,
		rows: blob.rows,
		isPublic: false,
		isFavorite: false,
		homePageId: blob.homePageId,
		lastEditedAt: blob.lastEditedAt,
		createdAt: blob.lastEditedAt,
		updatedAt: blob.lastEditedAt,
	}));
}

export async function cacheBlob(blob: ProjectBlob, dirty = false, clearDraft = false): Promise<number> {
	const db = await getDB();
	const tx = db.transaction('projectBlobs', 'readwrite');
	const existing = await tx.store.get(blob.id);
	const revision = dirty ? (existing?.revision ?? 0) + 1 : (existing?.revision ?? 0);

	await tx.store.put({
		...existing,
		...(clearDraft ? { draft: undefined } : {}),
		etag: undefined,
		id: blob.id,
		blob,
		cachedAt: Date.now(),
		dirty,
		revision,
	});
	await tx.done;
	return revision;
}

export async function reconcileCachedBlobAfterSync(
	projectId: string,
	sentRevision: number,
	serverLastEditedAt: string,
): Promise<SyncReconciliation | null> {
	const db = await getDB();
	const tx = db.transaction('projectBlobs', 'readwrite');
	const current = await tx.store.get(projectId);

	if (!current) {
		await tx.done;
		return null;
	}

	const reconciliation = reconcileSuccessfulSync(current, sentRevision, serverLastEditedAt);
	reconciliation.entry.cachedAt = Date.now();
	await tx.store.put(reconciliation.entry);
	await tx.done;
	return reconciliation;
}

export async function getDirtyBlobIds(): Promise<string[]> {
	const db = await getDB();
	const all = await db.getAll('projectBlobs');
	return all.filter((e) => e.dirty).map((e) => e.id);
}

export async function isBlobCached(projectId: string): Promise<boolean> {
	const db = await getDB();
	const key = await db.getKey('projectBlobs', projectId);
	return key !== undefined;
}

export async function deleteCachedBlob(projectId: string): Promise<void> {
	const db = await getDB();
	await db.delete('projectBlobs', projectId);
	const { removeBoardImages } = await import('../board-images');
	await removeBoardImages(projectId);
}

/** Draft writes never alter the committed board or mark it eligible for sync. */
export async function cacheDraft(projectId: string, draft?: ProjectBlob): Promise<void> {
	const db = await getDB();
	const tx = db.transaction('projectBlobs', 'readwrite');
	const entry = await tx.store.get(projectId);
	if (!entry) throw new Error('Save the board on this device before editing.');
	await tx.store.put({ ...entry, draft });
	await tx.done;
}

/** A response may arrive after an edit in this window or another tab. Check inside the write transaction. */
export async function cacheRemoteBlob(blob: ProjectBlob, revision: number, etag?: string): Promise<boolean> {
	const db = await getDB();
	const tx = db.transaction('projectBlobs', 'readwrite');
	const entry = await tx.store.get(blob.id);
	if (entry?.dirty || (entry?.revision ?? 0) !== revision) {
		await tx.done;
		return false;
	}
	await tx.store.put({ ...entry, id: blob.id, blob, cachedAt: Date.now(), dirty: false, revision, etag });
	await tx.done;
	return true;
}
