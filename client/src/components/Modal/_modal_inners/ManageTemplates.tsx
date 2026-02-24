import { createSignal, For, Show } from 'solid-js';
import { blobDeleteTemplate, blobRenameTemplate } from '@/lib/blob-actions';
import { cn } from '@/lib/cn';
import { navigateToPageInProject } from '@/lib/page-actions';
import {
	currentPageId,
	getTemplatePagesFromBlob,
	project,
	projectBlob,
	setActiveModalId,
	setEditingTiles,
	setPageIdBeforeTemplateEdit,
} from '@/lib/state';
import type { PageBlob } from '@/lib/types';

export default function ManageTemplates() {
	const [renamingId, setRenamingId] = createSignal<string | null>(null);
	const [editName, setEditName] = createSignal('');
	const [deletingId, setDeletingId] = createSignal<string | null>(null);

	const templates = () => getTemplatePagesFromBlob();

	const currentProject = () => project();
	const columns = () => currentProject()?.columns ?? 4;
	const rows = () => currentProject()?.rows ?? 4;

	const handleView = (template: PageBlob) => {
		// Store current page ID to return to after exiting template edit
		setPageIdBeforeTemplateEdit(currentPageId());
		setActiveModalId('');
		navigateToPageInProject(template.id);
		setEditingTiles(true);
	};

	const startRenaming = (template: PageBlob) => {
		setRenamingId(template.id);
		setEditName(template.name);
	};

	const cancelRenaming = () => {
		setRenamingId(null);
		setEditName('');
	};

	const handleRename = (template: PageBlob) => {
		const newName = editName().trim();
		if (!newName || newName === template.name) return;

		blobRenameTemplate(template.id, newName);
		setRenamingId(null);
	};

	const handleKeyDown = (e: KeyboardEvent, template: PageBlob) => {
		if (e.key === 'Enter') {
			handleRename(template);
		} else if (e.key === 'Escape') {
			cancelRenaming();
		}
	};

	const confirmDelete = (template: PageBlob) => {
		blobDeleteTemplate(template.id);
		setDeletingId(null);
	};

	// Count pages linked to this template
	const linkedPagesCount = (template: PageBlob) => {
		const blob = projectBlob();
		if (!blob) return 0;
		return blob.pages.filter((p) => p.templatePageId === template.id).length;
	};

	// Mini preview
	const TemplateMiniPreview = (props: { template: PageBlob }) => {
		const cellSize = 10;
		const gap = 1;

		const getTileAt = (x: number, y: number) => {
			return props.template.tiles.find((t) => t.x === x && t.y === y);
		};

		return (
			<div
				class="inline-grid shrink-0 rounded border border-zinc-600 bg-zinc-900 p-1"
				style={{
					'grid-template-columns': `repeat(${columns()}, ${cellSize}px)`,
					'grid-template-rows': `repeat(${rows()}, ${cellSize}px)`,
					gap: `${gap}px`,
				}}
			>
				<For each={Array.from({ length: rows() })}>
					{(_, y) => (
						<For each={Array.from({ length: columns() })}>
							{(_, x) => {
								const tile = getTileAt(x(), y());
								return (
									<div
										class="rounded-sm"
										style={{
											'background-color': tile ? (tile.backgroundColor ?? '#fafafa') : 'transparent',
											border: tile ? `1px solid ${tile.borderColor ?? '#71717a'}` : 'none',
										}}
									/>
								);
							}}
						</For>
					)}
				</For>
			</div>
		);
	};

	return (
		<div class="flex flex-col gap-4">
			<Show when={templates().length > 0}>
				<div class="max-h-[400px] overflow-y-auto">
					<For each={templates()}>
						{(template, index) => (
							<div
								class={cn('flex items-center gap-3 py-3', {
									'border-t border-zinc-700': index() !== 0,
								})}
							>
								<TemplateMiniPreview template={template} />
								<div class="flex-1 min-w-0">
									<Show
										when={renamingId() !== template.id}
										fallback={
											<div class="flex items-center gap-2">
												<input
													type="text"
													value={editName()}
													onInput={(e) => setEditName(e.currentTarget.value)}
													onKeyDown={(e) => handleKeyDown(e, template)}
													autofocus
													class="h-7 flex-1 rounded border border-zinc-600 bg-zinc-700 px-2 text-sm text-white outline-none focus:border-blue-500"
												/>
												<button
													onClick={() => handleRename(template)}
													disabled={!editName().trim() || editName().trim() === template.name}
													class="cursor-pointer rounded p-1 text-green-400 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
												>
													<i class="bi bi-check-lg" />
												</button>
												<button
													onClick={cancelRenaming}
													class="cursor-pointer rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-700"
												>
													<i class="bi bi-x-lg" />
												</button>
											</div>
										}
									>
										<p class="truncate text-zinc-200">{template.name}</p>
										<p class="text-xs text-zinc-500">
											{columns()} x {rows()} &middot; {template.tiles.length} tile{template.tiles.length !== 1 ? 's' : ''}
										</p>
									</Show>
								</div>
								<Show when={renamingId() !== template.id}>
									<Show
										when={deletingId() === template.id}
										fallback={
											<div class="flex items-center gap-1">
												<button
													title="View/Edit"
													onClick={() => handleView(template)}
													class="grid h-8 w-8 cursor-pointer place-items-center rounded text-zinc-400 transition-colors hover:bg-blue-500/10 hover:text-blue-400"
												>
													<i class="bi bi-eye" />
												</button>
												<button
													title="Rename"
													onClick={() => startRenaming(template)}
													class="grid h-8 w-8 cursor-pointer place-items-center rounded text-zinc-400 transition-colors hover:bg-yellow-500/10 hover:text-yellow-400"
												>
													<i class="bi bi-input-cursor-text" />
												</button>
												<button
													title="Delete"
													onClick={() => setDeletingId(template.id)}
													class="grid h-8 w-8 cursor-pointer place-items-center rounded text-zinc-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
												>
													<i class="bi bi-trash" />
												</button>
											</div>
										}
									>
										<div class="flex items-center gap-2">
											<span class="text-sm text-zinc-400">Delete?</span>
											<button
												onClick={() => confirmDelete(template)}
												class="cursor-pointer rounded-md bg-red-600 px-3 py-1 text-sm text-white transition-colors hover:bg-red-500"
											>
												Yes
											</button>
											<button
												onClick={() => setDeletingId(null)}
												class="cursor-pointer rounded-md border border-zinc-600 px-3 py-1 text-sm text-zinc-300 transition-colors hover:bg-zinc-700"
											>
												No
											</button>
										</div>
									</Show>
								</Show>
							</div>
						)}
					</For>
				</div>
			</Show>

			<Show when={templates().length === 0}>
				<div class="flex flex-col items-center gap-2 py-4 text-center">
					<i class="bi bi-grid-3x3 text-2xl text-zinc-500" />
					<p class="text-zinc-400">No templates yet</p>
					<p class="text-sm text-zinc-500">Select tiles and use "Create Template" to make one</p>
				</div>
			</Show>

			<div class="flex justify-end border-t border-zinc-700 pt-4">
				<button
					onClick={() => setActiveModalId('')}
					class="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-all hover:bg-zinc-700 hover:text-white"
				>
					Close
				</button>
			</div>
		</div>
	);
}
