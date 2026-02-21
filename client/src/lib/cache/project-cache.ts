import { getDB, type CachedProject } from './db';
import type { Project } from '../types';

export async function getCachedProject(projectId: string): Promise<Project | null> {
  try {
    const db = await getDB();
    const cached = await db.get('projects', projectId);

    if (cached) {
      // Update lastAccessedAt (fire and forget - don't block return)
      const updated: CachedProject = { ...cached, lastAccessedAt: Date.now() };
      db.put('projects', updated).catch(() => {});
      return cached.project;
    }

    return null;
  } catch (error) {
    console.warn('Failed to get cached project:', error);
    return null;
  }
}

export async function cacheProject(project: Project): Promise<void> {
  try {
    const db = await getDB();
    const now = Date.now();
    const cachedProject: CachedProject = {
      id: project.id,
      project,
      cachedAt: now,
      lastAccessedAt: now,
    };
    await db.put('projects', cachedProject);
  } catch (error) {
    console.warn('Failed to cache project:', error);
  }
}

export async function invalidateProjectCache(projectId: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete('projects', projectId);
  } catch (error) {
    console.warn('Failed to invalidate project cache:', error);
  }
}

export async function invalidateAllProjectCache(): Promise<void> {
  try {
    const db = await getDB();
    await db.clear('projects');
  } catch (error) {
    console.warn('Failed to clear project cache:', error);
  }
}
