import type { ProjectBlob } from '../types';
import { getDB } from './db';

export async function getCachedBlob(projectId: string): Promise<ProjectBlob | null> {
	const db = await getDB();
	const entry = await db.get('projectBlobs', projectId);
	return entry?.blob ?? null;
}

export async function cacheBlob(blob: ProjectBlob, dirty = false): Promise<void> {
	const db = await getDB();
	await db.put('projectBlobs', {
		id: blob.id,
		blob,
		cachedAt: Date.now(),
		dirty,
	});
}

export async function markBlobDirty(projectId: string): Promise<void> {
	const db = await getDB();
	const entry = await db.get('projectBlobs', projectId);
	if (entry) {
		entry.dirty = true;
		await db.put('projectBlobs', entry);
	}
}

export async function markBlobClean(projectId: string): Promise<void> {
	const db = await getDB();
	const entry = await db.get('projectBlobs', projectId);
	if (entry) {
		entry.dirty = false;
		await db.put('projectBlobs', entry);
	}
}

export async function getDirtyBlobIds(): Promise<string[]> {
	const db = await getDB();
	const all = await db.getAll('projectBlobs');
	return all.filter((e) => e.dirty).map((e) => e.id);
}

export async function deleteCachedBlob(projectId: string): Promise<void> {
	const db = await getDB();
	await db.delete('projectBlobs', projectId);
}
