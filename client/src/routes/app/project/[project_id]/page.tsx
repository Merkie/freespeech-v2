import { useNavigate, useParams, useSearchParams } from '@solidjs/router';
import { type Component, createEffect, on, onCleanup, onMount, Show } from 'solid-js';
import {
	checkAndRevalidate,
	exitEditModeAfterExternalUpdate,
	flushDirtyBlobs,
	hasUnsavedEditChanges,
} from '@/lib/blob-sync';
import { saveBoardImages } from '@/lib/board-images';
import { saveBoardResume } from '@/lib/board-resume';
import {
	cancelProjectLoad,
	clearLastVisitedProject,
	lastVisitedProjectId,
	loadProject,
	navigateHomeInProject,
} from '@/lib/page-actions';
import {
	boardScrollPosition,
	currentPageId,
	editingTiles,
	localSettings,
	projectBlob,
	projectLoading,
	resetProjectState,
	sentence,
	setEditingTilePositions,
	setEditingTiles,
	setMultiSelectMode,
	setSyncStatus,
	setUsingOnlineSearch,
} from '@/lib/state';
import ProjectContent from './_components/ProjectContent';
import ProjectContentSkeleton from './_components/ProjectContentSkeleton';
import ProjectHeader from './_components/ProjectHeader';
import SentenceBuilder from './_components/SentenceBuilder';

const AppProjectPage: Component = () => {
	const params = useParams();
	const [searchParams, setSearchParams] = useSearchParams();
	const navigate = useNavigate();
	let refreshInFlight = false;
	let disposed = false;

	const refreshBoard = async () => {
		const projectId = params.project_id;
		if (
			!projectId ||
			!navigator.onLine ||
			document.visibilityState !== 'visible' ||
			refreshInFlight ||
			hasUnsavedEditChanges()
		)
			return;
		refreshInFlight = true;
		try {
			const updated = await checkAndRevalidate(projectId);
			if (!updated) return;

			if (editingTiles()) {
				exitEditModeAfterExternalUpdate();
				setEditingTiles(false);
				setEditingTilePositions([]);
				setMultiSelectMode(false);
				setUsingOnlineSearch(false);
			}

			const current = currentPageId();
			if (current && !projectBlob()?.pages.some((page) => page.id === current)) {
				navigateHomeInProject();
			}
		} finally {
			refreshInFlight = false;
		}
	};

	// Online/offline listeners for sync
	const handleOnline = () => {
		flushDirtyBlobs().catch((err) => console.error('Failed to flush dirty blobs:', err));
		void refreshBoard();
	};
	const handleOffline = () => {
		setSyncStatus('offline');
	};
	const handleVisibilityChange = () => {
		// A registered Background Sync may have fired while this installed PWA was suspended and
		// deliberately deferred to its still-open window. Drain those edits as soon as the board is
		// usable again, even if WebKit does not replay an `online` event on resume.
		if (document.visibilityState === 'visible' && navigator.onLine) handleOnline();
	};
	let refreshTimer: ReturnType<typeof setInterval> | undefined;

	onMount(() => {
		window.addEventListener('online', handleOnline);
		window.addEventListener('offline', handleOffline);
		document.addEventListener('visibilitychange', handleVisibilityChange);
		refreshTimer = setInterval(() => void refreshBoard(), 5000);
	});

	onCleanup(() => {
		disposed = true;
		cancelProjectLoad();
		window.removeEventListener('online', handleOnline);
		window.removeEventListener('offline', handleOffline);
		document.removeEventListener('visibilitychange', handleVisibilityChange);
		if (refreshTimer) clearInterval(refreshTimer);
	});

	// React to route param changes
	createEffect(
		on(
			() => params.project_id,
			async (projectId, prevProjectId) => {
				// Skip if same project or missing
				if (projectId === prevProjectId || !projectId) return;

				// Reset state when switching from one project to another
				if (prevProjectId) {
					resetProjectState();
				}

				const explicit = typeof searchParams.page === 'string' ? searchParams.page : undefined;
				const success = await loadProject(projectId, { setHomePage: true, pageId: explicit });
				if (disposed || params.project_id !== projectId) return;
				if (explicit) setSearchParams({ page: undefined }, { replace: true });
				if (!success) {
					// A stored board that no longer loads would keep hijacking Home, so forget it and let
					// the next start fall back to one that still exists.
					if (lastVisitedProjectId() === projectId) clearLastVisitedProject();
					navigate('/app/dashboard/projects');
					return;
				}
				// Let the saved board paint before background network work starts.
				requestAnimationFrame(() => {
					void refreshBoard();
				});
			},
			{ defer: false },
		),
	);

	createEffect(() => {
		const blob = projectBlob();
		if (blob && !projectLoading() && !editingTiles()) {
			const timer = setTimeout(() => void saveBoardImages(blob), 250);
			onCleanup(() => clearTimeout(timer));
		}
	});

	createEffect(() => {
		const blob = projectBlob();
		const pageId = currentPageId();
		if (!projectLoading() && blob && blob.id === params.project_id && pageId && !editingTiles()) {
			saveBoardResume({ projectId: blob.id, pageId, sentence: sentence(), scroll: boardScrollPosition() });
		}
	});

	// Show skeleton while loading or when no blob/page is loaded
	const isLoading = () => projectLoading() || !projectBlob() || !currentPageId();

	return (
		<>
			<ProjectHeader />
			{/* Hide sentence builder when in edit mode (matches Svelte behavior) */}
			<Show when={!editingTiles() && localSettings().sentenceBuilder}>
				<SentenceBuilder />
			</Show>
			<Show fallback={<ProjectContentSkeleton />} when={!isLoading()}>
				<ProjectContent />
			</Show>
		</>
	);
};

export default AppProjectPage;
