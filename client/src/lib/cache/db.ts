import { type DBSchema, type IDBPDatabase, openDB } from 'idb';
import type { CachedProjectBlob } from '../types';

interface FreeSpeechDB extends DBSchema {
	projectBlobs: {
		key: string;
		value: CachedProjectBlob;
		indexes: { 'by-cachedAt': number; 'by-dirty': number };
	};
}

const DB_NAME = 'freespeech-cache';
const DB_VERSION = 3;

// Max cache size in bytes (50MB) - generous for AAC boards
const MAX_CACHE_SIZE_BYTES = 50 * 1024 * 1024;

let dbPromise: Promise<IDBPDatabase<FreeSpeechDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<FreeSpeechDB>> {
	if (!dbPromise) {
		dbPromise = openDB<FreeSpeechDB>(DB_NAME, DB_VERSION, {
			upgrade(db) {
				// Clean up old stores from previous versions
				for (const name of ['projects', 'pages', 'pendingMutations'] as const) {
					if (db.objectStoreNames.contains(name as never)) {
						db.deleteObjectStore(name as never);
					}
				}

				// Project blobs store (for offline-first sync)
				if (!db.objectStoreNames.contains('projectBlobs')) {
					const blobStore = db.createObjectStore('projectBlobs', { keyPath: 'id' });
					blobStore.createIndex('by-cachedAt', 'cachedAt');
					blobStore.createIndex('by-dirty', 'dirty');
				}
			},
		});
	}
	return dbPromise;
}

// Clear all cached data
export async function clearCache(): Promise<void> {
	const db = await getDB();
	const tx = db.transaction(['projectBlobs'], 'readwrite');
	await Promise.all([
		tx.objectStore('projectBlobs').clear(),
		tx.done,
	]);
}

// Estimate size of a cached entry in bytes
function estimateSize(obj: unknown): number {
	return new Blob([JSON.stringify(obj)]).size;
}

// Evict least recently used entries if cache exceeds max size
export async function evictLRUIfNeeded(): Promise<{ evictedBlobs: number }> {
	const db = await getDB();

	const allBlobs = await db.getAll('projectBlobs');
	let totalSize = 0;
	const blobEntries: Array<{ id: string; size: number; cachedAt: number; dirty: boolean }> = [];

	for (const entry of allBlobs) {
		const size = estimateSize(entry);
		blobEntries.push({
			id: entry.id,
			size,
			cachedAt: entry.cachedAt,
			dirty: entry.dirty,
		});
		totalSize += size;
	}

	if (totalSize <= MAX_CACHE_SIZE_BYTES) {
		return { evictedBlobs: 0 };
	}

	// Sort by cachedAt (oldest first), never evict dirty blobs
	const evictable = blobEntries
		.filter((b) => !b.dirty)
		.sort((a, b) => a.cachedAt - b.cachedAt);

	let bytesToFree = totalSize - MAX_CACHE_SIZE_BYTES;
	let evictedBlobs = 0;

	for (const entry of evictable) {
		if (bytesToFree <= 0) break;

		await db.delete('projectBlobs', entry.id);
		evictedBlobs++;
		bytesToFree -= entry.size;
	}

	if (evictedBlobs > 0) {
		console.log(`Cache eviction: removed ${evictedBlobs} blobs to free space`);
	}

	return { evictedBlobs };
}
