export { getDB, clearCache, evictLRUIfNeeded } from './db';
export type { CachedProject, CachedPage, PendingMutation } from './db';

export {
  getCachedProject,
  cacheProject,
  invalidateProjectCache,
  invalidateAllProjectCache,
} from './project-cache';

export {
  getCachedPage,
  cachePage,
  invalidatePageCache,
  invalidateAllPageCache,
  invalidateProjectPages,
} from './page-cache';
export type { PageWithTemplate } from './page-cache';
