import { type Component, createEffect, createSignal, For, Show } from 'solid-js';
import api from '@/lib/api';
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
	pendingTileEdits,
	project,
	projectHomePageId,
	setEditingTilePositions,
	setLoading,
	setPendingTileEdits,
	setUnsavedChanges,
	setUsingOnlineSearch,
	tilePositionKey,
} from '@/lib/state';

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
	const [hasUnsavedChanges, setHasUnsavedChanges] = createSignal(false);
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

	// Track unsaved changes
	createEffect(() => {
		const positions = editingTilePositions();
		const pending = pendingTileEdits();

		if (positions.length === 0) {
			setHasUnsavedChanges(false);
			setUnsavedChanges(false);
			return;
		}

		// For bulk mode, check if colors have been changed
		if (isBulkEditing()) {
			const hasChanges = pending.backgroundColor !== undefined || pending.borderColor !== undefined;
			setHasUnsavedChanges(hasChanges);
			setUnsavedChanges(hasChanges);
			return;
		}

		// For single tile, compare pending changes to original
		const originalTile = firstSelectedTile();
		if (!originalTile) {
			setHasUnsavedChanges(false);
			setUnsavedChanges(false);
			return;
		}

		const hasChanges =
			(pending.text !== undefined && pending.text !== originalTile.text) ||
			(pending.displayText !== undefined && pending.displayText !== originalTile.displayText) ||
			(pending.image !== undefined && pending.image !== originalTile.image) ||
			(pending.backgroundColor !== undefined && pending.backgroundColor !== originalTile.backgroundColor) ||
			(pending.borderColor !== undefined && pending.borderColor !== originalTile.borderColor) ||
			(pending.navigation !== undefined && pending.navigation !== originalTile.navigation);

		setHasUnsavedChanges(hasChanges);
		setUnsavedChanges(hasChanges);
	});

	const handleRemoveBackground = async () => {
		const pending = pendingTileEdits();
		const image = pending.image ?? firstSelectedTile()?.image;
		if (!image) return;

		setRemovingBackground(true);
		try {
			const { image_url } = await api.media.removeBackground(image);
			setPendingTileEdits({ ...pending, image: image_url });
		} catch (error) {
			console.error('Failed to remove background:', error);
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
			setPendingTileEdits({
				...pendingTileEdits(),
				image: `https://media.freespeechaac.com/${key}`,
			});
		}
	};

	const handleSaveChanges = () => {
		const pending = pendingTileEdits();
		const tilesToUpdate = selectedTiles();
		const currentPid = pageId();

		if (tilesToUpdate.length === 0 || !currentPid) return;

		if (isBulkEditing()) {
			// Bulk color update via blob
			blobUpdateTilesBatch(
				currentPid,
				tilesToUpdate.map((t) => ({ x: t.x, y: t.y, page: t.page })),
				{
					backgroundColor: pending.backgroundColor ?? tilesToUpdate[0].backgroundColor,
					borderColor: pending.borderColor ?? tilesToUpdate[0].borderColor,
				},
			);
		} else {
			// Single tile update via blob
			const tile = tilesToUpdate[0];
			blobUpdateTile(currentPid, { x: tile.x, y: tile.y, page: tile.page }, {
				text: pending.text ?? tile.text,
				displayText: pending.displayText ?? tile.displayText,
				image: pending.image ?? tile.image,
				backgroundColor: pending.backgroundColor ?? tile.backgroundColor,
				borderColor: pending.borderColor ?? tile.borderColor,
				navigation: pending.navigation ?? tile.navigation,
			});
		}

		// Update thumbnail if this is the home page
		if (isHomePage()) {
			void api.project.updateThumbnail(project()?.id || '');
		}

		// Clear editing state
		setEditingTilePositions([]);
		setPendingTileEdits({});
	};

	const handleCancelChanges = () => {
		// In bulk mode, just clear the pending color changes
		if (isBulkEditing()) {
			setPendingTileEdits({});
			return;
		}

		const tile = firstSelectedTile();
		if (!tile) return;
		// Reset pending edits to original tile values
		setPendingTileEdits({
			text: tile.text,
			displayText: tile.displayText,
			image: tile.image,
			backgroundColor: tile.backgroundColor,
			borderColor: tile.borderColor,
			navigation: tile.navigation,
		});
	};

	const handleDeleteTiles = () => {
		const tilesToDelete = selectedTiles();
		const currentPid = pageId();
		if (tilesToDelete.length === 0 || !currentPid) return;

		// Delete tiles via blob mutation
		blobDeleteTiles(
			currentPid,
			tilesToDelete.map((t) => ({ x: t.x, y: t.y, page: t.page })),
		);

		// Update thumbnail if this is the home page
		if (isHomePage()) {
			void api.project.updateThumbnail(project()?.id || '');
		}

		// Clear editing state
		setEditingTilePositions([]);
		setPendingTileEdits({});
	};

	const setTileColor = (colorKey: string) => {
		const colorValues = tileColors[colorKey as keyof typeof tileColors];
		setPendingTileEdits({
			...pendingTileEdits(),
			backgroundColor: colorValues.background_color,
			borderColor: colorValues.border_color,
		});
	};

	const updateTileText = (text: string) => {
		setPendingTileEdits({ ...pendingTileEdits(), text });
	};

	const updateTileDisplayText = (displayText: string) => {
		setPendingTileEdits({ ...pendingTileEdits(), displayText });
	};

	const updateTileNavigation = (navigation: string) => {
		setPendingTileEdits({ ...pendingTileEdits(), navigation });
	};

	const removeImage = () => {
		setPendingTileEdits({ ...pendingTileEdits(), image: '' });
	};

	// Get the current display value for a field (pending or original)
	const getDisplayValue = (field: keyof ReturnType<typeof pendingTileEdits>): string => {
		const pending = pendingTileEdits();
		const tile = firstSelectedTile();
		if (pending[field] !== undefined) {
			return (pending[field] as string) || '';
		}
		if (tile) {
			return (tile[field as keyof typeof tile] as string) || '';
		}
		return '';
	};

	// Check if current color matches a preset
	const isColorSelected = (colorKey: string) => {
		const colorValues = tileColors[colorKey as keyof typeof tileColors];
		const bgColor = getDisplayValue('backgroundColor');
		const borderColor = getDisplayValue('borderColor');
		return bgColor === colorValues.background_color && borderColor === colorValues.border_color;
	};

	// Check if a page color matches the current selection
	const isPageColorSelected = (bgColor: string, borderColor: string) => {
		return getDisplayValue('backgroundColor') === bgColor && getDisplayValue('borderColor') === borderColor;
	};

	// Get unique colors from tiles on the current page that aren't in default palette, sorted by frequency
	const pageColors = () => {
		const defaultColors = Object.values(tileColors);
		const colorMap = new Map<string, { backgroundColor: string; borderColor: string; count: number }>();

		for (const tile of tiles()) {
			const bg = tile.backgroundColor;
			const border = tile.borderColor;
			if (!bg || !border) continue;

			// Skip if it matches any default color
			const isDefault = defaultColors.some((c) => c.background_color === bg && c.border_color === border);
			if (isDefault) continue;

			// Use combined key to deduplicate and count frequency
			const key = `${bg}|${border}`;
			const existing = colorMap.get(key);
			if (existing) {
				existing.count++;
			} else {
				colorMap.set(key, { backgroundColor: bg, borderColor: border, count: 1 });
			}
		}

		// Sort by frequency (most used first)
		return Array.from(colorMap.values()).sort((a, b) => b.count - a.count);
	};

	const setPageColor = (bgColor: string, borderColor: string) => {
		setPendingTileEdits({
			...pendingTileEdits(),
			backgroundColor: bgColor,
			borderColor: borderColor,
		});
	};

	// Classes to disable sections in bulk mode
	const disabledInBulk = () => (isBulkEditing() ? 'opacity-50 pointer-events-none select-none' : '');

	return (
		<div
			class="flex w-[350px] flex-col overflow-y-auto border border-zinc-800 bg-zinc-900 p-4 text-zinc-200 shadow-md"
			style={{ height: `${props.height}px` }}
		>
			<Show when={editingTilePositions().length > 0} fallback={<EmptyState />}>
				{/* Tile Text */}
				<div class={disabledInBulk()}>
					<p class="mb-2">Tile Text:</p>
					<input
						type="text"
						value={getDisplayValue('text')}
						onInput={(e) => updateTileText(e.currentTarget.value)}
						class="w-full rounded-md border border-zinc-300 bg-white p-1 px-2 text-zinc-800"
					/>

					<Show when={showingDisplayTextOption() || getDisplayValue('displayText')}>
						<p class="my-2">Tile Display Text:</p>
						<input
							type="text"
							value={getDisplayValue('displayText')}
							onInput={(e) => updateTileDisplayText(e.currentTarget.value)}
							class="w-full rounded-md border border-zinc-300 bg-white p-1 px-2 text-zinc-800"
						/>
					</Show>
					<Show when={!showingDisplayTextOption() && !getDisplayValue('displayText')}>
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
							when={getDisplayValue('image')}
							fallback={
								<div class="flex flex-wrap gap-2">
									<button
										onClick={() => fileinput?.click()}
										class="rounded-md border border-zinc-700 bg-zinc-800 p-1 px-3 text-sm"
									>
										<i class="bi bi-upload mr-1" /> Upload Image From Device
									</button>
									<button
										onClick={() => setUsingOnlineSearch(true)}
										class="rounded-md border border-zinc-700 bg-zinc-800 p-1 px-3 text-sm"
									>
										<i class="bi bi-search" /> Search for Images Online
									</button>
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
									src={getDisplayValue('image')}
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
							value={getDisplayValue('navigation')}
							onChange={(e) => updateTileNavigation(e.currentTarget.value)}
						>
							<option value="">No Navigation</option>
							<For each={pages()}>{(page) => <option value={page.id}>{page.name}</option>}</For>
						</select>
					</div>
				</div>

				{/* Save/Cancel buttons */}
				<button
					disabled={!hasUnsavedChanges()}
					class="mt-6 flex items-center justify-center gap-2 rounded-md border border-blue-500 bg-blue-600 p-1 disabled:opacity-50"
					onClick={handleSaveChanges}
				>
					<i class="bi bi-check-lg" />
					<span>Save Changes</span>
				</button>

				<button
					onClick={handleCancelChanges}
					class="mt-4 flex items-center justify-center gap-2 rounded-md border border-zinc-500 bg-zinc-600 p-1 disabled:opacity-50"
					disabled={!hasUnsavedChanges()}
				>
					<i class="bi bi-x-lg" />
					<span>Cancel Changes</span>
				</button>

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
