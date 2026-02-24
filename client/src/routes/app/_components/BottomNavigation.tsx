import { A, useLocation } from '@solidjs/router';
import type { Component } from 'solid-js';
import { cn } from '@/lib/cn';
import { navigateToPageInProject } from '@/lib/page-actions';
import {
	currentPageId,
	editingTiles,
	pageIdBeforeTemplateEdit,
	project,
	projectBlob,
	projectHomePageId,
	setDiscardUnsavedChangesHandler,
	setEditingTileIds,
	setEditingTiles,
	setPageIdBeforeTemplateEdit,
	setPendingTileEdits,
	setUnsavedChanges,
	setUnsavedChangesModalOpen,
	setUsingOnlineSearch,
	unsavedChanges,
} from '@/lib/state';

const BottomNavigation: Component = () => {
	const location = useLocation();

	const handleHomeClick = (e: MouseEvent) => {
		if (!unsavedChanges()) {
			setEditingTiles(false);
			setUsingOnlineSearch(false);
			setEditingTileIds([]);
			setPendingTileEdits({});
			setUnsavedChanges(false);
			// Reset to home page when clicking home button
			const homeId = projectHomePageId();
			if (homeId) {
				navigateToPageInProject(homeId);
			}
		} else {
			e.preventDefault();
			setDiscardUnsavedChangesHandler(() => () => {
				setEditingTiles(false);
				setUsingOnlineSearch(false);
				setEditingTileIds([]);
				setPendingTileEdits({});
				setUnsavedChanges(false);
				const homeId = projectHomePageId();
				if (homeId) {
					navigateToPageInProject(homeId);
				}
			});
			setUnsavedChangesModalOpen(true);
		}
	};

	// URL is now just the project ID - page is managed via state
	const homeUrl = () => {
		const projectId = project()?.id;
		return projectId ? `/app/project/${projectId}` : '/app/dashboard/projects';
	};

	return (
		<div class="flex gap-2 border border-x-0 border-b-0 border-zinc-700 bg-zinc-900 p-2 text-[25px] font-light text-zinc-100">
			{/* Home button */}
			<A
				aria-label="Home"
				onClick={handleHomeClick}
				class={cn('flex-1 rounded-md p-1 text-center transition-colors', {
					'bg-zinc-800': !location.pathname.startsWith('/app/dashboard') && !editingTiles(),
				})}
				href={homeUrl()}
			>
				<i class="bi bi-house-fill"></i>
			</A>

			{/* Edit Button */}
			<button
				aria-label="Edit tiles"
				onClick={() => {
					if (editingTiles()) {
						// Exiting edit mode - clear editing state
						setEditingTiles(false);
						setEditingTileIds([]);
						setPendingTileEdits({});
						setUnsavedChanges(false);

						// If we were editing a template, navigate back to the previous page
						const pageId = currentPageId();
					const blob = projectBlob();
					const isOnTemplatePage = !!(blob && pageId && blob.pages.some((p) => p.templatePageId === pageId));
						const previousPageId = pageIdBeforeTemplateEdit();
						if (isOnTemplatePage && previousPageId) {
							navigateToPageInProject(previousPageId);
							setPageIdBeforeTemplateEdit(null);
						}
					} else {
						// Entering edit mode
						setEditingTiles(true);
					}
				}}
				class={cn('flex-1 rounded-md p-1 text-center transition-colors', {
					'bg-blue-500': !location.pathname.startsWith('/app/dashboard') && editingTiles(),
				})}
				disabled={location.pathname.startsWith('/app/dashboard')}
			>
				<i class="bi bi-pencil-fill"></i>
			</button>

			{/* Dashboard Button */}
			<A
				aria-label="Dashboard"
				href="/app/dashboard/projects"
				class={cn('flex-1 rounded-md p-1 text-center transition-colors', {
					'bg-zinc-800': location.pathname.startsWith('/app/dashboard'),
					'pointer-events-none opacity-50': editingTiles(),
				})}
			>
				<i class="bi bi-gear-fill"></i>
			</A>
		</div>
	);
};

export default BottomNavigation;
