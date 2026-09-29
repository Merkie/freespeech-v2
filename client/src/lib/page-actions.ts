import { batch } from 'solid-js';
import api from './api';
import { exitEditModeAfterExternalUpdate, loadProjectBlob } from './blob-sync';
import { getHomePageId, readBoardResume, resolveResumePage } from './board-resume';
import { getCachedProjects } from './cache/blob-cache';
import { extendNavigationPath, resetNavigationPath, stepBackInNavigationPath } from './navigation-path';
import { pickDefaultProject } from './project-order';
import {
	currentPageId,
	localSettings,
	pageHistory,
	projectBlob,
	resetProjectState,
	setBoardScrollPosition,
	setBoardScrollReset,
	setCurrentPageId,
	setLocalSettings,
	setPageHistory,
	setProjectLoading,
	setSentence,
} from './state';
import { consumeSwReloadState } from './sw-update';

// Helper to update last visited project/page in localStorage
function trackVisit(projectId: string, pageId?: string) {
	setLocalSettings({
		...localSettings(),
		lastVisitedProjectId: projectId,
		lastVisitedPageId:
			pageId ?? (localSettings().lastVisitedProjectId === projectId ? localSettings().lastVisitedPageId : ''),
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

	const cached = pickDefaultProject(await getCachedProjects().catch(() => []));
	if (cached) return cached.id;
	try {
		const { projects } = await api.project.list();
		return pickDefaultProject(projects ?? [])?.id ?? null;
	} catch {
		return pickDefaultProject(await getCachedProjects())?.id ?? null;
	}
}

let loadGeneration = 0;
export function cancelProjectLoad() {
	loadGeneration++;
}

export async function loadProject(
	projectId: string,
	options?: { setHomePage?: boolean; pageId?: string },
): Promise<boolean> {
	const request = ++loadGeneration;
	const resume = readBoardResume();
	const savedPage = localSettings().lastVisitedProjectId === projectId ? localSettings().lastVisitedPageId : undefined;
	exitEditModeAfterExternalUpdate();
	resetProjectState();
	setProjectLoading(true);
	try {
		const success = await loadProjectBlob(projectId, () => request === loadGeneration);
		if (request !== loadGeneration) return false;
		const blob = projectBlob();
		if (!success || !blob) return false;
		if (options?.setHomePage) {
			batch(() => {
				const page = resolveResumePage(
					blob,
					options.pageId ?? consumeSwReloadState(projectId, blob) ?? undefined,
					savedPage,
				);
				navigateToPageInProject(page);
				if (!options.pageId && resume?.projectId === projectId && resume.pageId === page) {
					setSentence(resume.sentence);
					setBoardScrollPosition(resume.scroll);
				}
			});
		} else trackVisit(projectId);
		return true;
	} catch (error) {
		console.error('Failed to load project:', error);
		return false;
	} finally {
		if (request === loadGeneration) setProjectLoading(false);
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

	// Remember the page being left so the header's back button can retrace the trail.
	// Empty means initial load; capped so a long session can't grow the stack forever.
	const from = currentPageId();
	if (from && from !== pageId) {
		setPageHistory(extendNavigationPath(pageHistory(), from, pageId));
	}

	batch(() => {
		setCurrentPageId(pageId);
		setBoardScrollPosition(0);
		setBoardScrollReset((value) => value + 1);
	});

	// Track this page visit
	trackVisit(blob.id, pageId);

	return true;
}

/**
 * Return to the board's root and start a fresh navigation path. Unlike an ordinary page link,
 * Home must not leave the page being exited behind for Back to revisit.
 */
export function navigateHomeInProject(): boolean {
	const blob = projectBlob();

	// Clear first so a Home press always resets the visible Back state, even if the board is still
	// loading or its configured home page was removed from malformed legacy data.
	setPageHistory(resetNavigationPath());
	if (!blob) {
		console.warn('No project blob loaded');
		return false;
	}

	const homePageId = getHomePageId(blob);
	if (!homePageId || !blob.pages.some((page) => page.id === homePageId)) {
		console.warn('Home page not found in blob');
		return false;
	}

	batch(() => {
		setCurrentPageId(homePageId);
		setBoardScrollPosition(0);
		setBoardScrollReset((value) => value + 1);
	});
	trackVisit(blob.id, homePageId);
	return true;
}

// Step back to the most recently visited page, skipping any that were deleted since.
// Does not push onto the history, so repeated presses walk further back.
export function navigateBackInProject(): boolean {
	const blob = projectBlob();
	if (!blob) return false;

	const step = stepBackInNavigationPath(pageHistory(), currentPageId(), (pageId) =>
		blob.pages.some((page) => page.id === pageId),
	);
	setPageHistory(step.path);
	if (!step.target) return false;

	batch(() => {
		setCurrentPageId(step.target!);
		setBoardScrollPosition(0);
		setBoardScrollReset((value) => value + 1);
	});
	trackVisit(blob.id, step.target);
	return true;
}
