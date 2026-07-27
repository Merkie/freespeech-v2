import { type Component, createSignal, For, Show } from 'solid-js';
import api from '@/lib/api';
import { OfflineError } from '@/lib/api/util';
import { blobDeleteTiles, blobUpdateTile, blobUpdateTilesBatch } from '@/lib/blob-actions';
import { cn } from '@/lib/cn';
import { uploadFile } from '@/lib/presigned-uploads';
import {
	currentPageId,
	editingTilePositions,
	findTileByPositionKey,
	getCurrentPageTiles,
	getProjectPagesFromBlob,
	isBulkEditing,
	localSettings,
	project,
	projectHomePageId,
	setEditingTilePositions,
	setLoading,
	setUsingOnlineSearch,
	tilePositionKey,
} from '@/lib/state';
import { showToast } from '@/lib/toast';

const tileColors = {
	white: {
		background_color: '#fafafa',
		border_color: '#71717a',
	},
	purple: {
		background_color: '#f3e8ff',
		border_color: '#a855f7',
	},
	yellow: {
		background_color: '#fef9c3',
		border_color: '#eab308',
	},
	pink: {
		background_color: '#fce7f3',
		border_color: '#ec4899',
	},
	green: {
		background_color: '#dcfce7',
		border_color: '#22c55e',
	},
	blue: {
		background_color: '#dbeafe',
		border_color: '#3b82f6',
	},
	orange: {
		background_color: '#ffedd5',
		border_color: '#f97316',
	},
	red: {
		background_color: '#fee2e2',
		border_color: '#ef4444',
	},
};

interface EditTilePanelProps {
	height: number;
}

const EditTilePanel: Component<EditTilePanelProps> = (props) => {
	const [showingDisplayTextOption, setShowingDisplayTextOption] = createSignal(false);
	const [removingBackground, setRemovingBackground] = createSignal(false);
	let fileinput: HTMLInputElement | undefined;

	const tiles = () => getCurrentPageTiles();
	const pages = () => getProjectPagesFromBlob();
	const isHomePage = () => currentPageId() === projectHomePageId();
	const pageId = () => currentPageId();

	// Get the first selected tile (for single tile editing display)
	const firstSelectedTile = () => {
		const positions = editingTilePositions();
		if (positions.length === 0) return null;
		return findTileByPositionKey(tiles(), positions[0]) || null;
	};

	// Get all selected tiles
	const selectedTiles = () => {
		const positions = editingTilePositions();
		return tiles().filter((t) => positions.includes(tilePositionKey(t)));
	};

	const handleRemoveBackground = async () => {
		const tile = firstSelectedTile();
		const image = tile?.image;
		if (!image) return;

		setRemovingBackground(true);
		try {
			const { image_url } = await api.media.removeBackground(image);
			const pos = tile;
			blobUpdateTile(pageId(), { x: pos.x, y: pos.y, page: pos.page }, { image: image_url });
		} catch (error) {
			if (error instanceof OfflineError) {
				showToast('This requires an internet connection', 'error');
			} else {
				showToast('Failed to remove background', 'error');
			}
		} finally {
			setRemovingBackground(false);
		}
	};

	const handleMediaUpload = async () => {
		if (!fileinput?.files) return;
		const uploadedFile = fileinput.files[0];

		setLoading(true);
		const key = await uploadFile(uploadedFile);
		setLoading(false);

		if (key) {
			const tile = firstSelectedTile();
			if (tile) {
				blobUpdateTile(
					pageId(),
					{ x: tile.x, y: tile.y, page: tile.page },
					{
						image: `https://media.freespeechaac.com/${key}`,
					},
				);
			}
		}
	};

	const handleDeleteTiles = () => {
		const tilesToDelete = selectedTiles();
		const currentPid = pageId();
		if (tilesToDelete.length === 0 || !currentPid) return;

		blobDeleteTiles(
			currentPid,
			tilesToDelete.map((t) => ({ x: t.x, y: t.y, page: t.page })),
		);

		if (isHomePage()) {
			void api.project.updateThumbnail(project()?.id || '');
		}

		setEditingTilePositions([]);
	};

	const setTileColor = (colorKey: string) => {
		const colorValues = tileColors[colorKey as keyof typeof tileColors];
		const currentPid = pageId();
		if (!currentPid) return;

		if (isBulkEditing()) {
			blobUpdateTilesBatch(
				currentPid,
				selectedTiles().map((t) => ({ x: t.x, y: t.y, page: t.page })),
				{ backgroundColor: colorValues.background_color, borderColor: colorValues.border_color },
			);
		} else {
			const tile = firstSelectedTile();
			if (tile) {
				blobUpdateTile(
					currentPid,
					{ x: tile.x, y: tile.y, page: tile.page },
					{
						backgroundColor: colorValues.background_color,
						borderColor: colorValues.border_color,
					},
				);
			}
		}
	};

	const updateTileText = (text: string) => {
		const tile = firstSelectedTile();
		if (!tile) return;
		blobUpdateTile(pageId(), { x: tile.x, y: tile.y, page: tile.page }, { text });
	};

	const updateTileDisplayText = (displayText: string) => {
		const tile = firstSelectedTile();
		if (!tile) return;
		blobUpdateTile(pageId(), { x: tile.x, y: tile.y, page: tile.page }, { displayText });
	};

	const updateTileNavigation = (navigation: string) => {
		const tile = firstSelectedTile();
		if (!tile) return;
		blobUpdateTile(pageId(), { x: tile.x, y: tile.y, page: tile.page }, { navigation });
	};

	const removeImage = () => {
		const tile = firstSelectedTile();
		if (!tile) return;
		blobUpdateTile(pageId(), { x: tile.x, y: tile.y, page: tile.page }, { image: '' });
	};

	// Check if current color matches a preset
	const isColorSelected = (colorKey: string) => {
		const colorValues = tileColors[colorKey as keyof typeof tileColors];
		const tile = firstSelectedTile();
		if (!tile) return false;
		return tile.backgroundColor === colorValues.background_color && tile.borderColor === colorValues.border_color;
	};

	// Check if a page color matches the current selection
	const isPageColorSelected = (bgColor: string, borderColor: string) => {
		const tile = firstSelectedTile();
		if (!tile) return false;
		return tile.backgroundColor === bgColor && tile.borderColor === borderColor;
	};

	// Get unique colors from tiles on the current page that aren't in default palette, sorted by frequency
	const pageColors = () => {
		const defaultColors = Object.values(tileColors);
		const colorMap = new Map<string, { backgroundColor: string; borderColor: string; count: number }>();

		for (const tile of tiles()) {
			const bg = tile.backgroundColor;
			const border = tile.borderColor;
			if (!bg || !border) continue;

			const isDefault = defaultColors.some((c) => c.background_color === bg && c.border_color === border);
			if (isDefault) continue;

			const key = `${bg}|${border}`;
			const existing = colorMap.get(key);
			if (existing) {
				existing.count++;
			} else {
				colorMap.set(key, { backgroundColor: bg, borderColor: border, count: 1 });
			}
		}

		return Array.from(colorMap.values()).sort((a, b) => b.count - a.count);
	};

	const setPageColor = (bgColor: string, borderColor: string) => {
		const currentPid = pageId();
		if (!currentPid) return;

		if (isBulkEditing()) {
			blobUpdateTilesBatch(
				currentPid,
				selectedTiles().map((t) => ({ x: t.x, y: t.y, page: t.page })),
				{ backgroundColor: bgColor, borderColor },
			);
		} else {
			const tile = firstSelectedTile();
			if (tile) {
				blobUpdateTile(
					currentPid,
					{ x: tile.x, y: tile.y, page: tile.page },
					{
						backgroundColor: bgColor,
						borderColor,
					},
				);
			}
		}
	};

	// Classes to disable sections in bulk mode
	const disabledInBulk = () => (isBulkEditing() ? 'opacity-50 pointer-events-none select-none' : '');

	return (
		<div
			class="flex w-[350px] touch-pan-y flex-col overflow-y-auto overscroll-contain border border-zinc-800 bg-zinc-900 p-4 text-zinc-200 shadow-md"
			style={{ height: `${props.height}px` }}
		>
			<Show when={editingTilePositions().length > 0} fallback={<EmptyState />}>
				{/* Tile Text */}
				<div class={disabledInBulk()}>
					<p class="mb-2">Tile Text:</p>
					<input
						type="text"
						value={firstSelectedTile()?.text ?? ''}
						onInput={(e) => updateTileText(e.currentTarget.value)}
						class="w-full rounded-md border border-zinc-300 bg-white p-1 px-2 text-zinc-800"
					/>

					<Show when={showingDisplayTextOption() || (firstSelectedTile()?.displayText ?? '')}>
						<p class="my-2">Tile Display Text:</p>
						<input
							type="text"
							value={firstSelectedTile()?.displayText ?? ''}
							onInput={(e) => updateTileDisplayText(e.currentTarget.value)}
							class="w-full rounded-md border border-zinc-300 bg-white p-1 px-2 text-zinc-800"
						/>
					</Show>
					<Show when={!showingDisplayTextOption() && !(firstSelectedTile()?.displayText ?? '')}>
						<button
							onClick={() => setShowingDisplayTextOption(true)}
							class="mt-2 text-left text-sm text-zinc-300 hover:underline"
						>
							Edit display text separately
						</button>
					</Show>
				</div>

				{/* Image */}
				<div class={cn('mt-6', disabledInBulk())}>
					<p class="my-2">Image:</p>
					<div class="flex flex-col gap-2">
						<Show
							when={firstSelectedTile()?.image}
							fallback={
								<div class="flex flex-wrap gap-2">
									<button
										onClick={() => fileinput?.click()}
										class="rounded-md border border-zinc-700 bg-zinc-800 p-1 px-3 text-sm"
									>
										<i class="bi bi-upload mr-1" /> Upload Image From Device
									</button>
									<Show when={localSettings().webImageSearch}>
										<button
											onClick={() => setUsingOnlineSearch(true)}
											class="rounded-md border border-zinc-700 bg-zinc-800 p-1 px-3 text-sm"
										>
											<i class="bi bi-search" /> Search for Images Online
										</button>
									</Show>
								</div>
							}
						>
							<div
								class="rounded-sm border border-zinc-700 p-2"
								style={{
									background: 'repeating-conic-gradient(#e5e5e5 0% 25%, #fff 0% 50%) 50% / 16px 16px',
								}}
							>
								<img
									src={firstSelectedTile()?.image}
									width={150}
									class="mx-auto rounded-md"
									alt="Uploaded media preview"
								/>
							</div>
							<div class="flex gap-2">
								<button
									onClick={handleRemoveBackground}
									disabled={removingBackground()}
									class="flex h-[30px] items-center gap-1 rounded-md border border-zinc-600 bg-zinc-700 px-2 text-sm text-white disabled:opacity-50"
									title="Remove background"
								>
									<Show when={removingBackground()} fallback={<i class="bi bi-eraser-fill" />}>
										<i class="bi bi-arrow-repeat animate-spin" />
									</Show>
									<span>Remove Background</span>
								</button>
								<button
									onClick={removeImage}
									class="grid h-[30px] w-[30px] place-items-center rounded-md bg-red-500 text-white"
									title="Remove image"
								>
									<i class="bi bi-trash-fill" />
								</button>
							</div>
						</Show>
					</div>
					<input ref={fileinput} onInput={handleMediaUpload} type="file" class="hidden" />
				</div>

				{/* Color - always enabled */}
				<p class="my-2 mt-6">Color:</p>
				<div class="flex flex-wrap gap-2 rounded-md text-black">
					<For each={Object.keys(tileColors)}>
						{(colorKey) => {
							const colorValues = tileColors[colorKey as keyof typeof tileColors];
							return (
								<button
									onClick={() => setTileColor(colorKey)}
									class={cn('text-md rounded-md border p-4 font-medium shadow-md', {
										'ring-2 ring-zinc-50': isColorSelected(colorKey),
									})}
									style={{
										'background-color': colorValues.background_color,
										'border-color': colorValues.border_color,
									}}
								>
									Aa
								</button>
							);
						}}
					</For>
				</div>

				{/* Page Colors */}
				<Show when={pageColors().length > 0}>
					<div class="mt-4 w-fit rounded-md bg-zinc-800 px-3 py-2">
						<p class="mb-2 text-xs text-zinc-400">Page Colors:</p>
						<div class="flex flex-wrap gap-2 text-black">
							<For each={pageColors()}>
								{(color) => (
									<button
										onClick={() => setPageColor(color.backgroundColor, color.borderColor)}
										class={cn('text-md rounded-md border p-4 font-medium shadow-md', {
											'ring-2 ring-zinc-50': isPageColorSelected(color.backgroundColor, color.borderColor),
										})}
										style={{
											'background-color': color.backgroundColor,
											'border-color': color.borderColor,
										}}
									>
										Aa
									</button>
								)}
							</For>
						</div>
					</div>
				</Show>

				{/* Navigation */}
				<div class={cn('mt-6', disabledInBulk())}>
					<p class="my-2">Navigation:</p>
					<div>
						<select
							class="rounded-md border border-zinc-300 bg-white p-1 px-2 text-zinc-800"
							value={firstSelectedTile()?.navigation ?? ''}
							onChange={(e) => updateTileNavigation(e.currentTarget.value)}
						>
							<option value="">No Navigation</option>
							<For each={pages()}>{(page) => <option value={page.id}>{page.name}</option>}</For>
						</select>
					</div>
				</div>

				<div class="flex-1" />

				<div class="my-8 flex flex-col">
					<div class="h-[1px] bg-zinc-800" />
					<div class="h-[1px] bg-zinc-950" />
				</div>

				{/* Delete button */}
				<button
					onClick={handleDeleteTiles}
					class="flex items-center justify-center gap-2 rounded-md border border-red-500 bg-red-600 p-1"
				>
					<i class="bi bi-trash-fill" />
					{isBulkEditing() ? `Delete ${editingTilePositions().length} Tiles` : 'Delete Tile'}
				</button>
			</Show>
		</div>
	);
};

function EmptyState() {
	return (
		<div class="flex flex-1 flex-col items-center justify-center text-zinc-500">
			<i class="bi bi-hand-index text-4xl mb-2" />
			<p class="text-center">Click on a tile to edit it</p>
		</div>
	);
}

export default EditTilePanel;
