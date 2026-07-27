import type { Project } from './types';

/**
 * The dashboard's default ordering: favourites pinned to the top, then most recently updated.
 * Mirrors the default sort in routes/app/dashboard/projects/page.tsx so that "the first project"
 * means the same thing wherever it is asked for — the board at the top of the user's list.
 */
export function pickDefaultProject(projects: Project[]): Project | null {
	if (projects.length === 0) return null;
	return [...projects].sort(byDashboardDefaultOrder)[0] ?? null;
}

function byDashboardDefaultOrder(a: Project, b: Project): number {
	if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
	return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}
