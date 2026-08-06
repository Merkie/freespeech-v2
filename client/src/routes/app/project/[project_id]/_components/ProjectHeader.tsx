import { createSignal, Show } from 'solid-js';
import useOutsideClick from '@/hooks/useOutsideClick';
import { editModeHasChanges } from '@/lib/blob-sync';
import { cn } from '@/lib/cn';
import { MODAL_ID } from '@/lib/constants';
import { navigateBackInProject } from '@/lib/page-actions';
import {
	currentPageId,
	editingTiles,
	getPageFromBlob,
	multiSelectMode,
	pageHistory,
	setActiveModalId,
	setMultiSelectMode,
	syncStatus,
} from '@/lib/state';

export default function ProjectHeader() {
	const [isPageDropdownOpen, setIsPageDropdownOpen] = createSignal(false);

	const [pageDropdownRef, setPageDropdownRef] = createSignal<HTMLDivElement | undefined>(undefined);

	useOutsideClick(pageDropdownRef, () => setIsPageDropdownOpen(false));

	const pageName = () => {
		const page = getPageFromBlob(currentPageId());
		return page?.name || 'Loading...';
	};

	// The page a back press would land on: the newest history entry that still exists
	const previousPage = () => {
		const history = pageHistory();
		for (let i = history.length - 1; i >= 0; i--) {
			if (history[i] === currentPageId()) continue;
			const page = getPageFromBlob(history[i]);
			if (page) return page;
		}
		return undefined;
	};

	const handleEditPage = () => {
		const page = getPageFromBlob(currentPageId());
		if (page) {
			setActiveModalId(MODAL_ID.EDIT_PAGE);
		}
		setIsPageDropdownOpen(false);
	};

	const handleAddPage = () => {
		setActiveModalId(MODAL_ID.CREATE_PAGE);
		setIsPageDropdownOpen(false);
	};

	const handleManagePages = () => {
		setActiveModalId(MODAL_ID.MANAGE_PAGES);
		setIsPageDropdownOpen(false);
	};

	return (
		<div class="relative flex h-14 shrink-0 touch-none items-center bg-zinc-900 px-3 text-zinc-100">
			{/* Left side - back button (view mode) or Page Actions (edit mode) */}
			<div class="flex flex-1 gap-2">
				<Show when={!editingTiles() && previousPage()}>
					<button
						onClick={() => navigateBackInProject()}
						aria-label="Go back to previous page"
						class="flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm transition-colors hover:bg-zinc-700"
					>
						<i class="bi bi-chevron-left text-zinc-400" />
						<span>{previousPage()?.name}</span>
					</button>
				</Show>
				<Show when={editingTiles()}>
					{/* Page Actions dropdown */}
					<div class="relative" ref={setPageDropdownRef}>
						<button
							onClick={() => setIsPageDropdownOpen(!isPageDropdownOpen())}
							class="flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm transition-colors hover:bg-zinc-700"
						>
							<i class="bi bi-grid-fill" />
							<span>Page Actions</span>
						</button>

						<div
							class={cn(
								'absolute left-0 top-full z-20 mt-1 flex w-fit flex-col rounded-md border border-zinc-700 bg-zinc-800 py-1 shadow-lg transition-all',
								{
									'pointer-events-auto translate-y-0 opacity-100': isPageDropdownOpen(),
									'pointer-events-none -translate-y-1 select-none opacity-0': !isPageDropdownOpen(),
								},
							)}
						>
							<Show when={pageName() !== 'Home'}>
								<button
									onClick={handleEditPage}
									class="flex items-center gap-2 whitespace-nowrap px-4 py-2 text-left text-sm transition-colors hover:bg-zinc-700"
								>
									<i class="bi bi-pencil" />
									<span>Edit "{pageName()}"</span>
								</button>
								<div class="mx-2 h-px bg-zinc-700" />
							</Show>
							<button
								onClick={handleAddPage}
								class="flex items-center gap-2 whitespace-nowrap px-4 py-2 text-left text-sm transition-colors hover:bg-zinc-700"
							>
								<i class="bi bi-plus-lg" />
								<span>Add New Page</span>
							</button>
							<div class="mx-2 h-px bg-zinc-700" />
							<button
								onClick={handleManagePages}
								class="flex items-center gap-2 whitespace-nowrap px-4 py-2 text-left text-sm transition-colors hover:bg-zinc-700"
							>
								<i class="bi bi-grid" />
								<span>Manage Pages</span>
							</button>
						</div>
					</div>
				</Show>
			</div>

			{/* Center - Page name */}
			<p class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-light">{pageName()}</p>

			{/* Right side - Sync status + Unsaved badge + Multi-select toggle */}
			<div class="flex flex-1 items-center justify-end gap-2">
				<SyncStatusIndicator />
				<Show when={editingTiles() && editModeHasChanges()}>
					<div class="flex items-center gap-1.5 rounded-md bg-yellow-500/10 px-2 py-1 text-xs text-yellow-400">
						<i class="bi bi-circle-fill text-[6px]" />
						<span>Unsaved changes</span>
					</div>
				</Show>
				<Show when={editingTiles()}>
					<button
						onClick={() => setMultiSelectMode(!multiSelectMode())}
						class={cn(
							'flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors',
							multiSelectMode()
								? 'border-blue-500 bg-blue-600 hover:bg-blue-500'
								: 'border-zinc-700 bg-zinc-800 hover:bg-zinc-700',
						)}
					>
						<i class={cn('bi', multiSelectMode() ? 'bi-check2-square' : 'bi-ui-checks')} />
						<span>{multiSelectMode() ? 'Multi-Select On' : 'Multi-Select'}</span>
					</button>
				</Show>
			</div>
		</div>
	);
}

function SyncStatusIndicator() {
	const status = () => syncStatus();

	return (
		<Show when={status() !== 'synced'}>
			<div
				class={cn('flex items-center gap-1.5 rounded-md px-2 py-1 text-xs', {
					'bg-yellow-500/10 text-yellow-400': status() === 'dirty' || status() === 'syncing',
					'bg-green-500/10 text-green-400': status() === 'synced',
					'bg-red-500/10 text-red-400': status() === 'conflict' || status() === 'error',
					'bg-zinc-500/10 text-zinc-400': status() === 'offline',
				})}
			>
				<Show when={status() === 'syncing'}>
					<i class="bi bi-arrow-repeat animate-spin" />
					<span>Saving...</span>
				</Show>
				<Show when={status() === 'dirty'}>
					<i class="bi bi-circle-fill text-[6px]" />
					<span>Unsaved</span>
				</Show>
				<Show when={status() === 'offline'}>
					<i class="bi bi-wifi-off" />
					<span>Offline — saved locally</span>
				</Show>
				<Show when={status() === 'conflict'}>
					<button onClick={() => setActiveModalId(MODAL_ID.SYNC_CONFLICT)} class="flex items-center gap-1.5">
						<i class="bi bi-exclamation-triangle" />
						<span class="underline">Sync conflict</span>
					</button>
				</Show>
				<Show when={status() === 'error'}>
					<i class="bi bi-exclamation-circle" />
					<span>Sync error</span>
				</Show>
			</div>
		</Show>
	);
}
