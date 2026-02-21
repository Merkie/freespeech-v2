import { batch } from 'solid-js';
import { getHomePageId } from '@/routes/app/project/[project_id]/page';
import { fetchPageWithCache, fetchProjectWithCache } from './api/cached-fetch';
import {
	localSettings,
	project,
	resetProjectState,
	setCurrentPage,
	setCurrentPageId,
	setCurrentPageTemplate,
	setCurrentPageTemplateTiles,
	setLocalSettings,
	setPageLoading,
	setProject,
	setProjectHomePageId,
	setProjectLoading,
} from './state';
import type { TilePageInProject } from './types';

// Helper to update last visited project/page in localStorage
function trackVisit(projectId: string, pageId?: string) {
	setLocalSettings({
		...localSettings(),
		lastVisitedProjectId: projectId,
		...(pageId && { lastVisitedPageId: pageId }),
	});
}

// Guard to prevent duplicate concurrent loads
let currentlyLoadingProjectId: string | null = null;

export async function loadProject(
	projectId: string,
	options?: { setHomePage?: boolean; skipCache?: boolean },
): Promise<boolean> {
	// Guard: prevent duplicate loads for same project
	if (currentlyLoadingProjectId === projectId) {
		return false;
	}

	currentlyLoadingProjectId = projectId;
	setProjectLoading(true);

	try {
		// Reset state before loading new project
		resetProjectState();

		// Use cached fetch with stale-while-revalidate strategy
		const { project: projectResponse, fromCache } = await fetchProjectWithCache(projectId, {
			skipCache: options?.skipCache,
			onRevalidate: (freshProject) => {
				// Update state with fresh data when revalidation completes
				const freshHomePageId = getHomePageId(freshProject);
				batch(() => {
					setProject(freshProject);
					setProjectHomePageId(freshHomePageId);
				});
			},
		});

		if (!projectResponse) {
			console.warn('Project not found');
			return false;
		}

		const homePageId = getHomePageId(projectResponse);

		// Batch state updates
		batch(() => {
			setProject(projectResponse);
			setProjectHomePageId(homePageId);
		});

		// Track this project visit
		trackVisit(projectId);

		// Stop showing loading indicator if data came from cache (instant load)
		if (fromCache) {
			setProjectLoading(false);
		}

		if (options?.setHomePage) {
			await navigateToPageInProject(homePageId, { skipCache: options?.skipCache });
		}

		return true;
	} catch (error) {
		console.error('Failed to load project:', error);
		return false;
	} finally {
		currentlyLoadingProjectId = null;
		setProjectLoading(false);
	}
}

export async function navigateToPageInProject(pageId: string, options?: { skipCache?: boolean }): Promise<boolean> {
	const projectId = project()?.id;
	if (!projectId) {
		console.warn('No project loaded');
		return false;
	}

	setPageLoading(true);

	try {
		// Use cached fetch with stale-while-revalidate strategy
		const { page, template, templateTiles, fromCache } = await fetchPageWithCache(pageId, {
			skipCache: options?.skipCache,
			onRevalidate: (freshData) => {
				// Update state with fresh data when revalidation completes
				const freshPageData = {
					tilePageId: freshData.page.id,
					tilePage: freshData.page,
					projectId,
					project: null,
				} as unknown as TilePageInProject;

				batch(() => {
					setCurrentPage(freshPageData);
					if (freshData.page.isTemplate) {
						setCurrentPageTemplate(null);
						setCurrentPageTemplateTiles([]);
					} else {
						setCurrentPageTemplate(freshData.template);
						setCurrentPageTemplateTiles(freshData.templateTiles || []);
					}
				});
			},
		});

		if (!page) {
			console.warn('Page not found');
			return false;
		}

		const pageData = {
			tilePageId: page.id,
			tilePage: page,
			projectId,
			project: null,
		} as unknown as TilePageInProject;

		// Set current page and template state
		batch(() => {
			setCurrentPage(pageData);
			setCurrentPageId(pageId);

			// If this page IS a template, don't set template overlay data
			// (we ARE the template source, not a page with a template applied)
			if (page.isTemplate) {
				setCurrentPageTemplate(null);
				setCurrentPageTemplateTiles([]);
			} else {
				setCurrentPageTemplate(template);
				setCurrentPageTemplateTiles(templateTiles || []);
			}
		});

		// Track this page visit
		trackVisit(projectId, pageId);

		// Stop showing loading indicator if data came from cache (instant load)
		if (fromCache) {
			setPageLoading(false);
		}

		return true;
	} catch (error) {
		console.error('Failed to navigate to page:', error);
		return false;
	} finally {
		setPageLoading(false);
	}
}
