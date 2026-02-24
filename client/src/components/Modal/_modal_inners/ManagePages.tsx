import { createSignal, For, Show } from 'solid-js';
import { tooltip } from '@/hooks/useTooltip';
import { blobDeletePage, blobRenamePage } from '@/lib/blob-actions';
import { cn } from '@/lib/cn';
import { MODAL_ID } from '@/lib/constants';
import { navigateToPageInProject } from '@/lib/page-actions';
import {
	currentPageId,
	getProjectPagesFromBlob,
	projectHomePageId,
	setActiveModalId,
} from '@/lib/state';

export default function ManagePages() {
	const [renamingId, setRenamingId] = createSignal<string | null>(null);
	const [editName, setEditName] = createSignal('');
	const [deletingId, setDeletingId] = createSignal<string | null>(null);

	// Get pages directly from blob — always up to date
	const pages = () => getProjectPagesFromBlob();

	const handleView = (pageId: string) => {
		setActiveModalId('');
		navigateToPageInProject(pageId);
	};

	const startRenaming = (page: { id: string; name: string }) => {
		setRenamingId(page.id);
		setEditName(page.name);
	};

	const cancelRenaming = () => {
		setRenamingId(null);
		setEditName('');
	};

	const handleRename = (pageId: string) => {
		const newName = editName().trim();
		const page = pages().find((p) => p.id === pageId);
		if (!newName || newName === page?.name) return;

		// Instant rename via blob mutation
		blobRenamePage(pageId, newName);
		setRenamingId(null);
	};

	const handleKeyDown = (e: KeyboardEvent, pageId: string) => {
		if (e.key === 'Enter') {
			handleRename(pageId);
		} else if (e.key === 'Escape') {
			cancelRenaming();
		}
	};

	const confirmDelete = (pageId: string) => {
		// Instant delete via blob mutation
		const success = blobDeletePage(pageId);
		if (!success) return;

		// If we're on the deleted page, switch to home page
		if (currentPageId() === pageId) {
			const homeId = projectHomePageId();
			navigateToPageInProject(homeId);
		}

		setDeletingId(null);
	};

	return (
		<div class="flex flex-col gap-4">
			<div class="max-h-[400px] overflow-y-auto">
				<For each={pages()}>
					{(page, index) => (
						<div
							class={cn('flex items-center gap-3 py-3', {
								'border-t border-zinc-700': index() !== 0,
							})}
						>
							<div class="min-w-0 flex-1">
								<Show
									when={renamingId() !== page.id}
									fallback={
										<div class="flex items-center gap-2">
											<input
												type="text"
												value={editName()}
												onInput={(e) => setEditName(e.currentTarget.value)}
												onKeyDown={(e) => handleKeyDown(e, page.id)}
												autofocus
												class="h-7 flex-1 rounded border border-zinc-600 bg-zinc-700 px-2 text-sm text-white outline-none focus:border-blue-500"
											/>
											<button
												onClick={() => handleRename(page.id)}
												disabled={!editName().trim() || editName().trim() === page.name}
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
									<p class="truncate text-zinc-200">{page.name}</p>
								</Show>
							</div>
							<Show when={renamingId() !== page.id}>
								<Show
									when={deletingId() === page.id}
									fallback={
										<div class="flex items-center gap-1">
											<button
												ref={tooltip('View/Edit')}
												onClick={() => handleView(page.id)}
												class="grid h-8 w-8 cursor-pointer place-items-center rounded text-zinc-400 transition-colors hover:bg-blue-500/10 hover:text-blue-400"
											>
												<i class="bi bi-eye" />
											</button>
											<button
												ref={tooltip('Rename')}
												onClick={() => page.name !== 'Home' && startRenaming(page)}
												class={cn(
													'grid h-8 w-8 cursor-pointer place-items-center rounded text-zinc-400 transition-colors hover:bg-yellow-500/10 hover:text-yellow-400',
													{ 'pointer-events-none select-none opacity-50': page.name === 'Home' },
												)}
											>
												<i class="bi bi-input-cursor-text" />
											</button>
											<button
												ref={tooltip('Delete')}
												onClick={() => page.name !== 'Home' && setDeletingId(page.id)}
												class={cn(
													'grid h-8 w-8 cursor-pointer place-items-center rounded text-zinc-400 transition-colors hover:bg-red-500/10 hover:text-red-400',
													{ 'pointer-events-none select-none opacity-50': page.name === 'Home' },
												)}
											>
												<i class="bi bi-trash" />
											</button>
										</div>
									}
								>
									<div class="flex items-center gap-2">
										<span class="text-sm text-zinc-400">Delete?</span>
										<button
											onClick={() => confirmDelete(page.id)}
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

			<Show when={pages().length === 0}>
				<div class="flex flex-col items-center gap-2 py-4 text-center">
					<i class="bi bi-file-earmark text-2xl text-zinc-500" />
					<p class="text-zinc-400">No pages yet</p>
				</div>
			</Show>

			<div class="flex justify-between border-t border-zinc-700 pt-4">
				<button
					onClick={() => setActiveModalId(MODAL_ID.CREATE_PAGE)}
					class="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
				>
					<i class="bi bi-plus-lg" />
					Add Page
				</button>
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
