import type { Project, ProjectBlob } from '../types';
import { getDB } from './db';

export async function getCachedBlob(projectId: string): Promise<ProjectBlob | null> {
	const db = await getDB();
	const entry = await db.get('projectBlobs', projectId);
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

export async function isBlobCached(projectId: string): Promise<boolean> {
	const db = await getDB();
	const key = await db.getKey('projectBlobs', projectId);
	return key !== undefined;
}

export async function deleteCachedBlob(projectId: string): Promise<void> {
	const db = await getDB();
	await db.delete('projectBlobs', projectId);
}
