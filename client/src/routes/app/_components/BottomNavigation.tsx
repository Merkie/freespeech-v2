import { A, useLocation, useNavigate } from '@solidjs/router';
import type { Component } from 'solid-js';
import { setPendingEditModeAction } from '@/components/Modal/_modal_inners/SaveEditMode';
import { discardEditMode, editModeHasChanges, enterEditMode } from '@/lib/blob-sync';
import { cn } from '@/lib/cn';
import { MODAL_ID } from '@/lib/constants';
import { lastVisitedProjectId, navigateToPageInProject } from '@/lib/page-actions';
import { pinLockActive } from '@/lib/pin';
import {
	editingTiles,
	project,
	projectHomePageId,
	requestPinUnlock,
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
	const navigate = useNavigate();

	const inDashboard = () => location.pathname.startsWith('/app/dashboard');

	// Runs `action` immediately, or behind the passcode prompt when the gate is on. The prompt is
	// shown on every gated attempt rather than unlocking for the rest of the visit: otherwise a
	// carer who unlocked edit mode would leave the dashboard open behind them.
	const gate = (prompt: string, action: () => void) => {
		if (!pinLockActive()) {
			action();
			return;
		}
		requestPinUnlock(prompt, action);
		setActiveModalId(MODAL_ID.PIN_ENTRY);
	};

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
			// Entering edit mode. Leaving it is never gated — the lock exists to keep people out
			// of edit mode, not to trap them in it.
			gate('Enter your passcode to edit this board.', () => {
				enterEditMode();
				setEditingTiles(true);
			});
		}
	};

	// The dashboard is where projects can be renamed and deleted, so leaving the board for it is
	// gated too. Navigating within the dashboard is not.
	const handleDashboardClick = (e: MouseEvent) => {
		if (inDashboard() || !pinLockActive()) return;
		e.preventDefault();
		gate('Enter your passcode to open the dashboard.', () => navigate('/app/dashboard/projects'));
	};

	// URL is now just the project ID - page is managed via state.
	//
	// The stored board wins over the in-memory one: `project()` is only populated once a board has
	// been loaded this session, so after a refresh on the dashboard it is empty and Home used to
	// point straight back at the dashboard. With neither, /app resolves a board to open.
	const homeUrl = () => {
		const projectId = lastVisitedProjectId() || project()?.id;
		return projectId ? `/app/project/${projectId}` : '/app';
	};

	return (
		<div
			class="flex shrink-0 touch-none gap-2 border border-x-0 border-b-0 border-zinc-700 bg-zinc-900 p-2 text-[25px] font-light text-zinc-100"
			style={{
				'padding-left': 'max(1.5rem, calc(0.5rem + env(safe-area-inset-left, 0px)))',
				'padding-right': 'max(1.5rem, calc(0.5rem + env(safe-area-inset-right, 0px)))',
				'padding-bottom': 'max(1.5rem, calc(0.5rem + env(safe-area-inset-bottom, 0px)))',
			}}
		>
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
				type="button"
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
				onClick={handleDashboardClick}
				class={cn('flex-1 rounded-md p-1 text-center transition-colors', {
					'bg-zinc-800': inDashboard(),
					'pointer-events-none opacity-50': editingTiles(),
				})}
			>
				<i class="bi bi-gear-fill"></i>
			</A>
		</div>
	);
};

export default BottomNavigation;
