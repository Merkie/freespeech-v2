/**
 * Cached API fetching with Stale-While-Revalidate strategy
 *
 * Strategy:
 * 1. Return cached data immediately (instant UI)
 * 2. Fetch fresh data in background
 * 3. Update cache silently
 * 4. If offline, return cached data only
 */

import api from './index';
import {
  getCachedProject,
  cacheProject,
  getCachedPage,
  cachePage,
  evictLRUIfNeeded,
  type PageWithTemplate,
} from '../cache';
import type { Project, TilePage, Tile, Template } from '../types';

export interface CachedProjectResult {
  project: Project;
  fromCache: boolean;
}

export interface CachedPageResult {
  page: TilePage;
  template: Template | null;
  templateTiles: Tile[];
  fromCache: boolean;
}

/**
 * Fetch project with stale-while-revalidate caching
 *
 * Returns cached data immediately if available, then revalidates in background.
 * If offline and no cache, throws an error.
 */
export async function fetchProjectWithCache(
  projectId: string,
  options?: {
    onRevalidate?: (project: Project) => void;
    skipCache?: boolean;
  }
): Promise<CachedProjectResult> {
  const { onRevalidate, skipCache = false } = options || {};

  // Try to get from cache first
  if (!skipCache) {
    const cached = await getCachedProject(projectId);
    if (cached) {
      // Return cached immediately, revalidate in background
      revalidateProject(projectId, onRevalidate);
      return { project: cached, fromCache: true };
    }
  }

  // No cache, fetch from network
  try {
    const { project } = await api.project.view(projectId);
    if (project) {
      await cacheProject(project);
    }
    return { project, fromCache: false };
  } catch (error) {
    // If offline and we have stale cache, use it
    if (!navigator.onLine) {
      const staleCache = await getCachedProject(projectId);
      if (staleCache) {
        return { project: staleCache, fromCache: true };
      }
    }
    throw error;
  }
}

/**
 * Fetch page with template using stale-while-revalidate caching
 */
export async function fetchPageWithCache(
  pageId: string,
  options?: {
    onRevalidate?: (result: PageWithTemplate) => void;
    skipCache?: boolean;
  }
): Promise<CachedPageResult> {
  const { onRevalidate, skipCache = false } = options || {};

  // Try to get from cache first
  if (!skipCache) {
    const cached = await getCachedPage(pageId);
    if (cached) {
      // Return cached immediately, revalidate in background
      revalidatePage(pageId, onRevalidate);
      return { ...cached, fromCache: true };
    }
  }

  // No cache, fetch from network
  try {
    const response = await api.page.viewWithTemplate(pageId);
    if (response.page) {
      await cachePage(response.page, response.template, response.templateTiles);
    }
    return {
      page: response.page,
      template: response.template,
      templateTiles: response.templateTiles,
      fromCache: false,
    };
  } catch (error) {
    // If offline and we have stale cache, use it
    if (!navigator.onLine) {
      const staleCache = await getCachedPage(pageId);
      if (staleCache) {
        return { ...staleCache, fromCache: true };
      }
    }
    throw error;
  }
}

/**
 * Background revalidation for project
 */
async function revalidateProject(
  projectId: string,
  onRevalidate?: (project: Project) => void
): Promise<void> {
  if (!navigator.onLine) return;

  try {
    const { project } = await api.project.view(projectId);
    if (project) {
      await cacheProject(project);
      onRevalidate?.(project);
      // Check if we need to evict old entries (fire and forget)
      evictLRUIfNeeded().catch(() => {});
    }
  } catch (error) {
    console.warn('Background project revalidation failed:', error);
  }
}

/**
 * Background revalidation for page
 */
async function revalidatePage(
  pageId: string,
  onRevalidate?: (result: PageWithTemplate) => void
): Promise<void> {
  if (!navigator.onLine) return;

  try {
    const response = await api.page.viewWithTemplate(pageId);
    if (response.page) {
      await cachePage(response.page, response.template, response.templateTiles);
      onRevalidate?.({
        page: response.page,
        template: response.template,
        templateTiles: response.templateTiles,
      });
      // Check if we need to evict old entries (fire and forget)
      evictLRUIfNeeded().catch(() => {});
    }
  } catch (error) {
    console.warn('Background page revalidation failed:', error);
  }
}
