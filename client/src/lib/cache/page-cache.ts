import { getDB, type CachedPage } from './db';
import type { TilePage, Tile, Template } from '../types';

export interface PageWithTemplate {
  page: TilePage;
  template: Template | null;
  templateTiles: Tile[];
}

export async function getCachedPage(pageId: string): Promise<PageWithTemplate | null> {
  try {
    const db = await getDB();
    const cached = await db.get('pages', pageId);

    if (cached) {
      // Update lastAccessedAt (fire and forget - don't block return)
      const updated: CachedPage = { ...cached, lastAccessedAt: Date.now() };
      db.put('pages', updated).catch(() => {});
      return {
        page: cached.page,
        template: cached.template,
        templateTiles: cached.templateTiles,
      };
    }

    return null;
  } catch (error) {
    console.warn('Failed to get cached page:', error);
    return null;
  }
}

export async function cachePage(
  page: TilePage,
  template: Template | null,
  templateTiles: Tile[]
): Promise<void> {
  try {
    const db = await getDB();
    const now = Date.now();
    const cachedPage: CachedPage = {
      id: page.id,
      page,
      template,
      templateTiles,
      cachedAt: now,
      lastAccessedAt: now,
    };
    await db.put('pages', cachedPage);
  } catch (error) {
    console.warn('Failed to cache page:', error);
  }
}

export async function invalidatePageCache(pageId: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete('pages', pageId);
  } catch (error) {
    console.warn('Failed to invalidate page cache:', error);
  }
}

export async function invalidateAllPageCache(): Promise<void> {
  try {
    const db = await getDB();
    await db.clear('pages');
  } catch (error) {
    console.warn('Failed to clear page cache:', error);
  }
}

// Invalidate all pages for a given project
// This is useful when the project structure changes
// Note: Currently invalidates all pages since we don't store projectId in page cache
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function invalidateProjectPages(_projectId: string): Promise<void> {
  // For now, invalidate all pages
  // In the future, we could store projectId in page cache to filter properly
  await invalidateAllPageCache();
}
