import { createEffect, createSignal, For, type ParentComponent, Show } from 'solid-js';
import { cn } from '@/lib/cn';
import { navigateToPageInProject } from '@/lib/page-actions';
import { speakText } from '@/lib/speak';
import {
	currentPageId,
	getCurrentPageTemplateTilesFromBlob,
	getCurrentPageTiles,
	editingTilePositions,
	editingTiles,
	getPageFromBlob,
	localSettings,
	multiSelectMode,
	pendingTileEdits,
	project,
	projectBlob,
	setEditingTilePositions,
	setPendingTileEdits,
	setSentence,
	speakingTilePosition,
	tilePositionKey,
	voiceEngineStatus,
} from '@/lib/state';
import type { Tile as TileType } from '@/lib/types';
import AddTileButton from './AddTileButton';
import Tile from './Tile';

// Extended tile type that tracks whether a tile is from a template
type RenderTile = TileType & { isTemplate?: boolean };

export default function TileSubpages({ containerHeight }: { containerHeight: () => number }) {
	const [reducedTiles, setReducedTiles] = createSignal<TileType[][]>([]);
	const [nextDbPage, setNextDbPage] = createSignal(0);

	// Use createEffect to react to blob/currentPageId changes
	createEffect(() => {
		const tiles = getCurrentPageTiles();
		setReducedTiles(reduceTileSubpages(tiles));
		// Calculate the next available DB page number for new subpages
		const maxPage = tiles.length > 0 ? Math.max(...tiles.map((t) => t.page)) : -1;
		setNextDbPage(maxPage + 1);
	});

	// Get subpages to render - add empty subpage at the end when in edit mode
	const subpagesToRender = () => {
		const reduced = reducedTiles();
		if (editingTiles()) {
			return [...reduced, []]; // Add empty subpage for creating new tiles
		}
		return reduced;
	};

	// Check if current page is a template (editing the template source directly)
	const isCurrentPageATemplate = () => {
		const page = getPageFromBlob(currentPageId());
		// A page that IS a template won't be in the blob's pages array normally,
		// but if it is (e.g., navigated to for editing), check if another page references it as template
		const blob = projectBlob();
		if (!blob || !page) return false;
		return blob.pages.some((p) => p.templatePageId === page.id);
	};

	// Merge page tiles with template tiles for a given subpage
	// Template tiles take precedence (overlay on top of page tiles at same position)
	const getMergedTilesForSubpage = (pageTiles: TileType[], pageIndex: number): RenderTile[] => {
		// Only merge template tiles on page 0, and not when editing the template itself
		if (pageIndex !== 0 || isCurrentPageATemplate()) {
			return pageTiles.map((t) => ({ ...t, isTemplate: false }));
		}

		const templateTiles = getCurrentPageTemplateTilesFromBlob();
		const templatePositions = new Set(templateTiles.map((t) => `${t.x},${t.y}`));

		// Filter out page tiles that are covered by template tiles
		const visiblePageTiles: RenderTile[] = pageTiles
			.filter((t) => !templatePositions.has(`${t.x},${t.y}`))
			.map((t) => ({ ...t, isTemplate: false }));

		// Add template tiles with isTemplate flag
		const templateRenderTiles: RenderTile[] = templateTiles.map((t) => ({
			...t,
			isTemplate: true,
		}));

		return [...visiblePageTiles, ...templateRenderTiles];
	};

	const handleTileClick = (tile: RenderTile, event: MouseEvent) => {
		// Template tiles have different click handling
		if (tile.isTemplate) {
			handleTemplateTileClick(tile);
			return;
		}

		const tileKey = tilePositionKey(tile);

		if (editingTiles()) {
			// In edit mode - handle selection
			if (event.shiftKey || multiSelectMode()) {
				// Shift+click or multi-select mode: toggle tile in selection
				const currentSelection = editingTilePositions();
				const isAlreadySelected = currentSelection.includes(tileKey);

				if (isAlreadySelected) {
					// Remove from selection
					const newSelection = currentSelection.filter((key) => key !== tileKey);
					setEditingTilePositions(newSelection);
					// Clear pending edits if no tiles left
					if (newSelection.length === 0) {
						setPendingTileEdits({});
					}
				} else {
					// Add to selection - keep pending edits (for bulk color changes)
					setEditingTilePositions([...currentSelection, tileKey]);
				}
			} else {
				// Regular click: select only this tile
				setEditingTilePositions([tileKey]);
				// Initialize pending edits with this tile's current values
				setPendingTileEdits({
					text: tile.text,
					displayText: tile.displayText,
					image: tile.image,
					backgroundColor: tile.backgroundColor,
					borderColor: tile.borderColor,
					navigation: tile.navigation,
				});
			}
			return;
		}

		// Block all tile interactions while speaking
		if (isTileBusy()) return;

		if (tile.navigation) {
			// Navigation tile - update state to load linked page
			navigateToPageInProject(tile.navigation);
		} else {
			// Non-navigation tile - speak and/or add to sentence
			const settings = localSettings();

			if (settings.speakOnTap) {
				speakText(tile.text, tileKey);
			}

			if (settings.sentenceBuilder) {
				setSentence((prev) => [...prev, tile]);
			}
		}
	};

	// Handle template tile click
	const handleTemplateTileClick = (templateTile: TileType) => {
		if (editingTiles()) {
			// In edit mode, template tiles are not editable from the page
			return;
		}

		// Block all tile interactions while speaking
		if (isTileBusy()) return;

		const tileKey = tilePositionKey(templateTile);

		if (templateTile.navigation) {
			navigateToPageInProject(templateTile.navigation);
		} else {
			const settings = localSettings();

			if (settings.speakOnTap) {
				speakText(templateTile.text, tileKey);
			}

			if (settings.sentenceBuilder) {
				setSentence((prev) => [...prev, templateTile]);
			}
		}
	};

	const isTileBusy = () => {
		const status = voiceEngineStatus();
		return status === 'synthesizing' || status === 'speaking';
	};

	const isTileSpeaking = (tile: TileType) => {
		return speakingTilePosition() === tilePositionKey(tile) && isTileBusy();
	};

	const isTileSelected = (tile: RenderTile) => {
		// Template tiles cannot be selected
		if (tile.isTemplate) return false;
		return editingTilePositions().includes(tilePositionKey(tile));
	};

	const isTileDimmed = (tile: RenderTile) => {
		if (!editingTiles()) return false;
		// Template tiles are never dimmed (they have their own opacity styling)
		if (tile.isTemplate) return false;
		const selected = editingTilePositions();
		// If any tiles are selected, dim tiles that aren't selected
		if (selected.length > 0) {
			return !selected.includes(tilePositionKey(tile));
		}
		return false;
	};

	// Get the display version of a tile - apply pending edits for live preview
	const getDisplayTile = (tile: RenderTile): RenderTile => {
		// Template tiles don't have pending edits
		if (tile.isTemplate) return tile;

		const selected = editingTilePositions();
		const pending = pendingTileEdits();
		const tileKey = tilePositionKey(tile);

		// Only apply pending edits to selected tiles
		if (selected.includes(tileKey)) {
			// For bulk editing (multiple tiles), only apply color changes
			if (selected.length > 1) {
				return {
					...tile,
					backgroundColor: pending.backgroundColor ?? tile.backgroundColor,
					borderColor: pending.borderColor ?? tile.borderColor,
				};
			}
			// For single tile editing, apply all pending changes
			return {
				...tile,
				text: pending.text ?? tile.text,
				displayText: pending.displayText ?? tile.displayText,
				image: pending.image ?? tile.image,
				backgroundColor: pending.backgroundColor ?? tile.backgroundColor,
				borderColor: pending.borderColor ?? tile.borderColor,
				navigation: pending.navigation ?? tile.navigation,
			};
		}
		return tile;
	};

	// Calculate unused coordinates for a given subpage
	const getUnusedCoords = (tiles: TileType[], pageIndex: number) => {
		const columns = project().columns;
		const rows = project().rows;
		const usedCoords = new Set(tiles.map((t) => `${t.x},${t.y}`));

		// Also exclude template tile positions on first subpage
		// (but NOT when editing the template itself - we want all positions available)
		if (pageIndex === 0 && !isCurrentPageATemplate()) {
			const templateTiles = getCurrentPageTemplateTilesFromBlob();
			for (const t of templateTiles) {
				usedCoords.add(`${t.x},${t.y}`);
			}
		}

		const unusedCoords: { x: number; y: number }[] = [];

		for (let x = 0; x < columns; x++) {
			for (let y = 0; y < rows; y++) {
				if (!usedCoords.has(`${x},${y}`)) {
					unusedCoords.push({ x, y });
				}
			}
		}

		return unusedCoords;
	};

	// Determine the correct DB page number for a given subpage's tiles
	const getDbPageForSubpage = (tiles: TileType[]) => {
		// If this is an existing subpage with tiles, use the tile's page number
		// (tiles in reducedTiles have re-indexed page numbers matching their display index)
		if (tiles.length > 0) {
			return tiles[0].page;
		}
		// If this is the empty subpage (no tiles), use the next available DB page
		return nextDbPage();
	};

	return (
		<For each={subpagesToRender()}>
			{(tiles, pageIndex) => (
				<TileSubpageContainer containerHeight={containerHeight} pageIndex={pageIndex}>
					{/* Merged tiles (page tiles + template tiles on page 0) */}
					<For each={getMergedTilesForSubpage(tiles, pageIndex())}>
						{(tile) => {
							// Use a function to get current display state for live updates
							const displayTile = () => getDisplayTile(tile);

							return (
								<Tile
									tile={displayTile()}
									isTemplate={tile.isTemplate}
									isSelected={isTileSelected(tile)}
									isDimmed={isTileDimmed(tile)}
									isSpeaking={isTileSpeaking(tile)}
									isEditMode={editingTiles()}
									onClick={(e) => handleTileClick(tile, e)}
								/>
							);
						}}
					</For>

					{/* Empty tile slots - only shown in edit mode */}
					<Show when={editingTiles()}>
						<For each={getUnusedCoords(tiles, pageIndex())}>
							{(coord) => <AddTileButton x={coord.x} y={coord.y} page={getDbPageForSubpage(tiles)} />}
						</For>
					</Show>
				</TileSubpageContainer>
			)}
		</For>
	);
}

const TileSubpageContainer: ParentComponent<{
	containerHeight: () => number;
	pageIndex: () => number;
}> = ({ containerHeight, pageIndex, children }) => {
	return (
		<div
			style={{
				height: `${containerHeight()}px`,
				top: `${containerHeight() * pageIndex()}px`,
				'grid-template-columns': `repeat(${project().columns}, 1fr)`,
				'grid-template-rows': `repeat(${project().rows}, 1fr)`,
			}}
			class={cn('absolute right-0 left-0 grid gap-2 bg-zinc-100 p-2', {
				'bg-zinc-200': pageIndex() % 2 === 1,
			})}
		>
			{children}
		</div>
	);
};

// This will get rid of empty subpages while preserving original page numbers
// (so tiles can be created with the correct DB page number)
function reduceTileSubpages(tiles: TileType[]): TileType[][] {
	return tiles
		.reduce((acc: TileType[][], tile: TileType) => {
			if (!acc[tile.page]) {
				acc[tile.page] = [];
			}
			acc[tile.page].push(tile);
			return acc;
		}, [])
		.filter(Boolean)
		.filter((item) => item.length > 0);
}
