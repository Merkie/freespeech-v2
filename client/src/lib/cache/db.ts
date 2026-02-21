import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Project, TilePage, Tile, Template } from '../types';

// Cached page data includes template information
export interface CachedPage {
  id: string;
  page: TilePage;
  template: Template | null;
  templateTiles: Tile[];
  cachedAt: number;
  lastAccessedAt?: number;
}

// Cached project data
export interface CachedProject {
  id: string;
  project: Project;
  cachedAt: number;
  lastAccessedAt?: number;
}

// Pending mutation for offline support
export interface PendingMutation {
  id: string;
  type: 'tile_update' | 'tile_create' | 'tile_delete' | 'page_update';
  payload: unknown;
  createdAt: number;
}

interface FreeSpeechDB extends DBSchema {
  projects: {
    key: string;
    value: CachedProject;
    indexes: { 'by-cachedAt': number };
  };
  pages: {
    key: string;
    value: CachedPage;
    indexes: { 'by-cachedAt': number };
  };
  pendingMutations: {
    key: string;
    value: PendingMutation;
    indexes: { 'by-createdAt': number };
  };
}

const DB_NAME = 'freespeech-cache';
const DB_VERSION = 1;

// Max cache size in bytes (50MB) - generous for AAC boards
const MAX_CACHE_SIZE_BYTES = 50 * 1024 * 1024;

let dbPromise: Promise<IDBPDatabase<FreeSpeechDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<FreeSpeechDB>> {
  if (!dbPromise) {
    dbPromise = openDB<FreeSpeechDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Projects store
        if (!db.objectStoreNames.contains('projects')) {
          const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
          projectStore.createIndex('by-cachedAt', 'cachedAt');
        }

        // Pages store
        if (!db.objectStoreNames.contains('pages')) {
          const pageStore = db.createObjectStore('pages', { keyPath: 'id' });
          pageStore.createIndex('by-cachedAt', 'cachedAt');
        }

        // Pending mutations store (for offline support)
        if (!db.objectStoreNames.contains('pendingMutations')) {
          const mutationStore = db.createObjectStore('pendingMutations', { keyPath: 'id' });
          mutationStore.createIndex('by-createdAt', 'createdAt');
        }
      },
    });
  }
  return dbPromise;
}

// Clear all cached data
export async function clearCache(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['projects', 'pages'], 'readwrite');
  await Promise.all([
    tx.objectStore('projects').clear(),
    tx.objectStore('pages').clear(),
    tx.done,
  ]);
}

// Estimate size of a cached entry in bytes
function estimateSize(obj: unknown): number {
  return new Blob([JSON.stringify(obj)]).size;
}

// Get effective last accessed time (falls back to cachedAt for old entries)
function getLastAccessed(entry: { lastAccessedAt?: number; cachedAt: number }): number {
  return entry.lastAccessedAt ?? entry.cachedAt ?? 0;
}

// Get total cache size and entries sorted by lastAccessedAt (oldest first)
async function getCacheStats(): Promise<{
  totalSize: number;
  projects: Array<{ id: string; size: number; lastAccessedAt: number }>;
  pages: Array<{ id: string; size: number; lastAccessedAt: number }>;
}> {
  const db = await getDB();

  const projects: Array<{ id: string; size: number; lastAccessedAt: number }> = [];
  const pages: Array<{ id: string; size: number; lastAccessedAt: number }> = [];
  let totalSize = 0;

  // Get all projects
  const allProjects = await db.getAll('projects');
  for (const entry of allProjects) {
    const size = estimateSize(entry);
    projects.push({
      id: entry.id,
      size,
      lastAccessedAt: getLastAccessed(entry),
    });
    totalSize += size;
  }

  // Get all pages
  const allPages = await db.getAll('pages');
  for (const entry of allPages) {
    const size = estimateSize(entry);
    pages.push({
      id: entry.id,
      size,
      lastAccessedAt: getLastAccessed(entry),
    });
    totalSize += size;
  }

  // Sort by lastAccessedAt (oldest first)
  projects.sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);
  pages.sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);

  return { totalSize, projects, pages };
}

// Evict least recently used entries if cache exceeds max size
export async function evictLRUIfNeeded(): Promise<{ evictedProjects: number; evictedPages: number }> {
  const stats = await getCacheStats();

  if (stats.totalSize <= MAX_CACHE_SIZE_BYTES) {
    return { evictedProjects: 0, evictedPages: 0 };
  }

  const db = await getDB();
  let bytesToFree = stats.totalSize - MAX_CACHE_SIZE_BYTES;
  let evictedProjects = 0;
  let evictedPages = 0;

  // Combine and sort all entries by lastAccessedAt (oldest first)
  const allEntries = [
    ...stats.projects.map((p) => ({ ...p, type: 'project' as const })),
    ...stats.pages.map((p) => ({ ...p, type: 'page' as const })),
  ].sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);

  // Evict oldest entries until we're under the limit
  for (const entry of allEntries) {
    if (bytesToFree <= 0) break;

    if (entry.type === 'project') {
      await db.delete('projects', entry.id);
      evictedProjects++;
    } else {
      await db.delete('pages', entry.id);
      evictedPages++;
    }

    bytesToFree -= entry.size;
  }

  if (evictedProjects > 0 || evictedPages > 0) {
    console.log(
      `Cache eviction: removed ${evictedProjects} projects and ${evictedPages} pages to free space`
    );
  }

  return { evictedProjects, evictedPages };
}
