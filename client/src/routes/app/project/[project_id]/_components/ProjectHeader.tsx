import { createSignal, Show } from 'solid-js';
import useOutsideClick from '@/hooks/useOutsideClick';
import { blobUnlinkTemplate } from '@/lib/blob-actions';
import { editModeHasChanges } from '@/lib/blob-sync';
import { cn } from '@/lib/cn';
import { MODAL_ID } from '@/lib/constants';
import { navigateToPageInProject } from '@/lib/page-actions';
import {
	currentPageId,
	editingTilePositions,
	editingTiles,
	getCurrentPageTiles,
	getPageFromBlob,
	getTemplateForPage,
	multiSelectMode,
	pageIdBeforeTemplateEdit,
	projectBlob,
	setActiveModalId,
	setEditingTiles,
	setMultiSelectMode,
	setPageIdBeforeTemplateEdit,
	syncStatus,
	tilePositionKey,
} from '@/lib/state';
import type { Tile } from '@/lib/types';

export default function ProjectHeader() {
	const [isPageDropdownOpen, setIsPageDropdownOpen] = createSignal(false);
	const [isTemplateDropdownOpen, setIsTemplateDropdownOpen] = createSignal(false);

	const [pageDropdownRef, setPageDropdownRef] = createSignal<HTMLDivElement | undefined>(undefined);
	const [templateDropdownRef, setTemplateDropdownRef] = createSignal<HTMLDivElement | undefined>(undefined);

	useOutsideClick(pageDropdownRef, () => setIsPageDropdownOpen(false));

	useOutsideClick(templateDropdownRef, () => setIsTemplateDropdownOpen(false));

	const pageName = () => {
		const page = getPageFromBlob(currentPageId());
		return page?.name || 'Loading...';
	};

	const currentTemplate = () => getTemplateForPage(currentPageId());
	const hasTemplate = () => currentTemplate() !== null;

	// Check if current page is a template being edited.
	// Combines two checks: (1) a page references this as its templatePageId, or
	// (2) we navigated here via "Edit Template" / "View/Edit" from ManageTemplates
	const isEditingTemplate = () => {
		if (pageIdBeforeTemplateEdit() !== null) return true;
		const blob = projectBlob();
		const pid = currentPageId();
		if (!blob || !pid) return false;
		return blob.pages.some((p) => p.templatePageId === pid);
	};

	// Check if there are selected tiles on page 0 (for creating templates)
	const hasSelectedTilesOnPage0 = () => {
		const tiles = getCurrentPageTiles();
		const selectedPositions = editingTilePositions();
		if (selectedPositions.length === 0) return false;
		return tiles.some((t: Tile) => selectedPositions.includes(tilePositionKey(t)) && t.page === 0);
	};

	const handleCreateTemplate = () => {
		setActiveModalId(MODAL_ID.CREATE_TEMPLATE);
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

	const handleApplyTemplate = () => {
		setActiveModalId(MODAL_ID.APPLY_TEMPLATE);
		setIsTemplateDropdownOpen(false);
	};

	const handleEditTemplate = () => {
		const template = currentTemplate();
		if (template) {
			// Store current page ID to return to after exiting template edit
			setPageIdBeforeTemplateEdit(currentPageId());
			// Navigate to the template page within the same project editor
			navigateToPageInProject(template.id);
			setEditingTiles(true);
		}
		setIsTemplateDropdownOpen(false);
	};

	const handleUnlinkTemplate = () => {
		const pageId = currentPageId();
		if (!pageId) return;

		blobUnlinkTemplate(pageId);
		setIsTemplateDropdownOpen(false);
	};

	const handleManageTemplates = () => {
		setActiveModalId(MODAL_ID.MANAGE_TEMPLATES);
		setIsTemplateDropdownOpen(false);
	};

	return (
		<div class="relative flex h-14 items-center bg-zinc-900 px-3 text-zinc-100">
			{/* Left side - Page Actions & Template Actions (only in edit mode) */}
			<div class="flex flex-1 gap-2">
				<Show when={editingTiles()}>
					{/* Page Actions dropdown */}
					<div class="relative" ref={setPageDropdownRef}>
						<button
							onClick={() => {
								setIsPageDropdownOpen(!isPageDropdownOpen());
								setIsTemplateDropdownOpen(false);
							}}
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

					{/* Template Actions dropdown */}
					<div class="relative" ref={setTemplateDropdownRef}>
						<button
							onClick={() => {
								setIsTemplateDropdownOpen(!isTemplateDropdownOpen());
								setIsPageDropdownOpen(false);
							}}
							class="flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm transition-colors hover:bg-zinc-700"
						>
							<i class="bi bi-grid-3x3" />
							<span>Template Actions</span>
						</button>

						<div
							class={cn(
								'absolute left-0 top-full z-20 mt-1 flex w-fit flex-col rounded-md border border-zinc-700 bg-zinc-800 py-1 shadow-lg transition-all',
								{
									'pointer-events-auto translate-y-0 opacity-100': isTemplateDropdownOpen(),
									'pointer-events-none -translate-y-1 select-none opacity-0': !isTemplateDropdownOpen(),
								},
							)}
						>
							<Show
								when={!isEditingTemplate() && hasTemplate()}
								fallback={
									<button
										onClick={handleApplyTemplate}
										disabled={isEditingTemplate()}
										class={cn(
											'flex items-center gap-2 whitespace-nowrap px-4 py-2 text-left text-sm transition-colors',
											isEditingTemplate()
												? 'cursor-not-allowed text-zinc-600'
												: 'hover:bg-zinc-700',
										)}
									>
										<i class="bi bi-grid-3x3" />
										<span>Apply Template</span>
									</button>
								}
							>
								<button
									onClick={handleEditTemplate}
									class="flex items-center gap-2 whitespace-nowrap px-4 py-2 text-left text-sm transition-colors hover:bg-zinc-700"
								>
									<i class="bi bi-pencil" />
									<span>Edit Template "{currentTemplate()?.name}"</span>
								</button>
								<button
									onClick={handleUnlinkTemplate}
									class="flex items-center gap-2 whitespace-nowrap px-4 py-2 text-left text-sm text-red-400 transition-colors hover:bg-zinc-700"
								>
									<i class="bi bi-x-lg" />
									<span>Unlink Template "{currentTemplate()?.name}"</span>
								</button>
							</Show>
							<div class="mx-2 h-px bg-zinc-700" />
							<button
								onClick={handleManageTemplates}
								class="flex items-center gap-2 whitespace-nowrap px-4 py-2 text-left text-sm transition-colors hover:bg-zinc-700"
							>
								<i class="bi bi-collection" />
								<span>Manage Templates</span>
							</button>
							<Show when={hasSelectedTilesOnPage0()}>
								<div class="mx-2 h-px bg-zinc-700" />
								<button
									onClick={handleCreateTemplate}
									class="flex items-center gap-2 whitespace-nowrap px-4 py-2 text-left text-sm transition-colors hover:bg-zinc-700"
								>
									<i class="bi bi-plus-lg" />
									<span>Create Template</span>
								</button>
							</Show>
						</div>
					</div>
				</Show>
			</div>

			{/* Center - Page name (with Template badge when editing a template) */}
			<Show
				when={isEditingTemplate()}
				fallback={<p class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-light">{pageName()}</p>}
			>
				<div class="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2">
					<span class="rounded bg-purple-600 px-2 py-0.5 text-xs font-medium">Template</span>
					<span class="font-light">{pageName()}</span>
				</div>
			</Show>

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
					<button
						onClick={() => setActiveModalId(MODAL_ID.SYNC_CONFLICT)}
						class="flex items-center gap-1.5"
					>
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
