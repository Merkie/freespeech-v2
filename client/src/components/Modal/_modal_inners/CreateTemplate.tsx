import { createMemo, createSignal, For, Show } from 'solid-js';
import api from '@/lib/api';
import { cn } from '@/lib/cn';
import {
	editingTilePositions,
	getCurrentPageTiles,
	project,
	setActiveModalId,
	setEditingTilePositions,
	tilePositionKey,
} from '@/lib/state';
import type { Tile } from '@/lib/types';

export default function CreateTemplate() {
	const [name, setName] = createSignal('');
	const [isLoading, setIsLoading] = createSignal(false);
	const [error, setError] = createSignal('');

	// Get selected tiles from current page (only page 0 tiles)
	const selectedTiles = createMemo(() => {
		const tiles = getCurrentPageTiles();
		const selectedPositions = editingTilePositions();
		return tiles.filter((tile: Tile) => selectedPositions.includes(tilePositionKey(tile)) && tile.page === 0);
	});

	const currentProject = () => project();

	// Mini preview grid dimensions
	const previewCellSize = 12;
	const previewGap = 1;

	const handleSubmit = async (e: Event) => {
		e.preventDefault();
		const proj = currentProject();
		if (isLoading() || !name().trim() || !proj) return;

		const tiles = selectedTiles();

		setIsLoading(true);
		setError('');

		try {
			const response = await api.template.create({
				name: name().trim(),
				projectId: proj.id,
				tiles: tiles.map((tile) => ({
					x: tile.x,
					y: tile.y,
					page: tile.page,
					text: tile.text,
					backgroundColor: tile.backgroundColor,
					borderColor: tile.borderColor,
					image: tile.image,
					navigation: tile.navigation,
					displayText: tile.displayText,
				})),
			});

			if ('error' in response) {
				setError(response.error as string);
				setIsLoading(false);
				return;
			}

			// Clear selection and close modal
			setEditingTilePositions([]);
			setActiveModalId('');
		} catch (_err) {
			setError('Failed to create template');
			setIsLoading(false);
		}
	};

	const isValid = () => name().trim().length > 0;

	return (
		<form onSubmit={handleSubmit} class="flex flex-col gap-4">
			<div>
				<label class="mb-2 block text-sm font-medium text-zinc-300">Template Name</label>
				<input
					type="text"
					value={name()}
					onInput={(e) => setName(e.currentTarget.value)}
					placeholder="Navigation Bar, Core Words..."
					class="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-sm text-white placeholder-zinc-500 outline-none transition-colors focus:border-blue-500"
					autofocus
				/>
			</div>

			{/* Mini preview grid */}
			<Show when={currentProject()}>
				<div>
					<label class="mb-2 block text-sm font-medium text-zinc-300">
						Preview ({selectedTiles().length} tile{selectedTiles().length !== 1 ? 's' : ''} selected)
					</label>
					<div
						class="inline-grid rounded border border-zinc-700 bg-zinc-900 p-2"
						style={{
							'grid-template-columns': `repeat(${currentProject()?.columns}, ${previewCellSize}px)`,
							'grid-template-rows': `repeat(${currentProject()?.rows}, ${previewCellSize}px)`,
							gap: `${previewGap}px`,
						}}
					>
						<For each={Array.from({ length: currentProject()?.rows })}>
							{(_, y) => (
								<For each={Array.from({ length: currentProject()?.columns })}>
									{(_, x) => {
										const tile = selectedTiles().find((t) => t.x === x() && t.y === y());
										return (
											<div
												class="rounded-sm"
												style={{
													'background-color': tile ? tile.backgroundColor : 'rgba(63, 63, 70, 0.3)',
													border: tile ? `1px solid ${tile.borderColor}` : '1px solid transparent',
												}}
											/>
										);
									}}
								</For>
							)}
						</For>
					</div>
				</div>
			</Show>

			<p class="text-sm text-zinc-400">
				Dimensions: {currentProject()?.columns} x {currentProject()?.rows}
			</p>

			<Show when={error()}>
				<p class="text-sm text-red-400">{error()}</p>
			</Show>

			<div class="flex justify-end gap-2 pt-2">
				<button
					type="button"
					onClick={() => setActiveModalId('')}
					class="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-all hover:bg-zinc-700 hover:text-white"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={!isValid() || isLoading()}
					class={cn('rounded-lg border px-4 py-2 text-sm font-medium transition-all', {
						'border-blue-500 bg-blue-600 text-white hover:bg-blue-500': isValid() && !isLoading(),
						'cursor-not-allowed border-zinc-700 bg-zinc-800 text-zinc-500': !isValid() || isLoading(),
					})}
				>
					{isLoading() ? 'Creating...' : 'Create Template'}
				</button>
			</div>
		</form>
	);
}
