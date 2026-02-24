import { batch } from 'solid-js';
import { loadProjectBlob } from './blob-sync';
import {
	localSettings,
	projectBlob,
	resetProjectState,
	setCurrentPageId,
	setLocalSettings,
	setProject,
	setProjectHomePageId,
	setProjectLoading,
} from './state';
import type { Project } from './types';

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
	options?: { setHomePage?: boolean },
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

		// Load the full project blob (IndexedDB first, then server)
		const success = await loadProjectBlob(projectId);

		if (!success) {
			console.warn('Project not found');
			return false;
		}

		const blob = projectBlob();
		if (!blob) return false;

		// Build a lightweight Project object for backwards compatibility
		const projectObj: Project = {
			id: blob.id,
			userId: '', // Not needed for display
			name: blob.name,
			description: blob.description,
			imageUrl: blob.imageUrl,
			columns: blob.columns,
			rows: blob.rows,
			isPublic: false,
			homePageId: blob.homePageId,
			lastEditedAt: blob.lastEditedAt,
			createdAt: blob.lastEditedAt,
			updatedAt: blob.lastEditedAt,
		};

		const homePageId = getHomePageId(blob);

		batch(() => {
			setProject(projectObj);
			setProjectHomePageId(homePageId);
		});

		// Track this project visit
		trackVisit(projectId);

		if (options?.setHomePage) {
			navigateToPageInProject(homePageId);
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

// Navigate to a page — instant (no network call)
// Template tiles are resolved from the blob's own pages array
export function navigateToPageInProject(pageId: string): boolean {
	const blob = projectBlob();
	if (!blob) {
		console.warn('No project blob loaded');
		return false;
	}

	const page = blob.pages.find((p) => p.id === pageId);
	if (!page) {
		console.warn('Page not found in blob:', pageId);
		return false;
	}

	setCurrentPageId(pageId);

	// Track this page visit
	trackVisit(blob.id, pageId);

	return true;
}

// Get home page ID from blob
function getHomePageId(blob: { homePageId: string | null; pages: { id: string; name: string; isTemplate?: boolean }[] }): string {
	if (blob.homePageId) return blob.homePageId;
	// Only consider non-template pages
	const nonTemplatePages = blob.pages.filter((p) => !p.isTemplate);
	const homePage = nonTemplatePages.find((p) => p.name.toLowerCase().trim() === 'home');
	return homePage?.id ?? nonTemplatePages[0]?.id ?? '';
}
