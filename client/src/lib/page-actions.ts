import { batch } from 'solid-js';
import api from './api';
import { loadProjectBlob } from './blob-sync';
import { getCachedProjects } from './cache/blob-cache';
import { pickDefaultProject } from './project-order';
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
import { consumeSwReloadState } from './sw-update';
import type { Project } from './types';

// Helper to update last visited project/page in localStorage
function trackVisit(projectId: string, pageId?: string) {
	setLocalSettings({
		...localSettings(),
		lastVisitedProjectId: projectId,
		...(pageId && { lastVisitedPageId: pageId }),
	});
}

/**
 * The board the app should open when it is not already on one — after a refresh, or from the Home
 * button anywhere outside a project. localStorage is the source of truth rather than the in-memory
 * `project()` signal, which only exists once a board has been loaded this session and so is empty
 * on every fresh page load.
 */
export function lastVisitedProjectId(): string {
	return localSettings().lastVisitedProjectId;
}

/** Forgets the stored board, so the next start falls back to one that still exists. */
export function clearLastVisitedProject(): void {
	setLocalSettings({ ...localSettings(), lastVisitedProjectId: '', lastVisitedPageId: '' });
}

/**
 * Resolves which board to open: the stored one, or the first in the dashboard's own order when
 * nothing is stored yet. Returns null only when the account has no projects, or the list could not
 * be fetched — a stored id never needs the network, so this stays offline-first.
 */
export async function resolveStartProjectId(): Promise<string | null> {
	const stored = lastVisitedProjectId();
	if (stored) return stored;

	try {
		const { projects } = await api.project.list();
		return pickDefaultProject(projects ?? [])?.id ?? null;
	} catch {
		return pickDefaultProject(await getCachedProjects())?.id ?? null;
	}
}

// Guard to prevent duplicate concurrent loads
let currentlyLoadingProjectId: string | null = null;

export async function loadProject(projectId: string, options?: { setHomePage?: boolean }): Promise<boolean> {
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
			isFavorite: false,
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
			// A deliberate PWA update reload should return to the exact communication context rather
			// than dumping the user at Home with an empty sentence builder.
			navigateToPageInProject(consumeSwReloadState(projectId, blob) ?? homePageId);
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
function getHomePageId(blob: { homePageId: string | null; pages: { id: string; name: string }[] }): string {
	if (blob.homePageId) return blob.homePageId;
	const homePage = blob.pages.find((p) => p.name.toLowerCase().trim() === 'home');
	return homePage?.id ?? blob.pages[0]?.id ?? '';
}
