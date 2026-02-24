import { useNavigate, useParams } from '@solidjs/router';
import { type Component, createEffect, on, onCleanup, onMount, Show } from 'solid-js';
import { flushDirtyBlobs } from '@/lib/blob-sync';
import { loadProject, navigateToPageInProject } from '@/lib/page-actions';
import {
	currentPageId,
	editingTemplate,
	editingTiles,
	localSettings,
	projectBlob,
	projectLoading,
	resetProjectState,
	setEditingTemplate,
	setEditingTiles,
	setSyncStatus,
} from '@/lib/state';
import type { Project } from '@/lib/types';
import ProjectContent from './_components/ProjectContent';
import ProjectContentSkeleton from './_components/ProjectContentSkeleton';
import ProjectHeader from './_components/ProjectHeader';
import SentenceBuilder from './_components/SentenceBuilder';

const AppProjectPage: Component = () => {
	const params = useParams();
	const navigate = useNavigate();

	// Online/offline listeners for sync
	const handleOnline = () => {
		flushDirtyBlobs().catch((err) => console.error('Failed to flush dirty blobs:', err));
	};
	const handleOffline = () => {
		setSyncStatus('offline');
	};

	onMount(() => {
		window.addEventListener('online', handleOnline);
		window.addEventListener('offline', handleOffline);
	});

	onCleanup(() => {
		window.removeEventListener('online', handleOnline);
		window.removeEventListener('offline', handleOffline);
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

				// Check if we're navigating to edit a specific template
				const templateToEdit = editingTemplate();

				const success = await loadProject(projectId, { setHomePage: !templateToEdit });
				if (!success) {
					navigate('/app/dashboard/projects');
					return;
				}

				// If editing a template, navigate to it and enter edit mode
				if (templateToEdit) {
					navigateToPageInProject(templateToEdit.id);
					setEditingTiles(true);
					setEditingTemplate(null); // Clear after use
				}
			},
			{ defer: false },
		),
	);

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

// This finds the page named "home" or the first page if "home" doesn't exist
export function getHomePageId(project: Project): string {
	return (
		project.homePageId ||
		((
			project.connectedPages?.find(({ tilePage }) => tilePage?.name.toLowerCase().trim() === 'home') ??
			project.connectedPages?.[0]
		)?.tilePageId ??
			'')
	);
}

export default AppProjectPage;
