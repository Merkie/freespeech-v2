import { A, useLocation } from '@solidjs/router';
import type { Component } from 'solid-js';
import { setPendingEditModeAction } from '@/components/Modal/_modal_inners/SaveEditMode';
import { discardEditMode, editModeHasChanges, enterEditMode } from '@/lib/blob-sync';
import { cn } from '@/lib/cn';
import { MODAL_ID } from '@/lib/constants';
import { navigateToPageInProject } from '@/lib/page-actions';
import {
	editingTiles,
	project,
	projectHomePageId,
	setActiveModalId,
	setEditingTilePositions,
	setEditingTiles,
	setMultiSelectMode,
	setUsingOnlineSearch,
} from '@/lib/state';

function exitEditModeClean() {
	setEditingTiles(false);
	setEditingTilePositions([]);
	setMultiSelectMode(false);
	setUsingOnlineSearch(false);
}

const BottomNavigation: Component = () => {
	const location = useLocation();

	const handleHomeClick = (e: MouseEvent) => {
		if (!editingTiles()) {
			// Not in edit mode — just navigate home
			const homeId = projectHomePageId();
			if (homeId) {
				navigateToPageInProject(homeId);
			}
			return;
		}

		// In edit mode — check for unsaved changes
		e.preventDefault();

		const navigateHome = () => {
			const homeId = projectHomePageId();
			if (homeId) {
				navigateToPageInProject(homeId);
			}
		};

		if (editModeHasChanges()) {
			setPendingEditModeAction(navigateHome);
			setActiveModalId(MODAL_ID.SAVE_EDIT_MODE);
		} else {
			discardEditMode();
			exitEditModeClean();
			navigateHome();
		}
	};

	const handleEditClick = () => {
		if (editingTiles()) {
			// Exiting edit mode
			if (editModeHasChanges()) {
				// Has changes — show save/discard modal
				setPendingEditModeAction(null);
				setActiveModalId(MODAL_ID.SAVE_EDIT_MODE);
			} else {
				// No changes — exit immediately
				discardEditMode();
				exitEditModeClean();
			}
		} else {
			// Entering edit mode
			enterEditMode();
			setEditingTiles(true);
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
				onClick={handleEditClick}
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
