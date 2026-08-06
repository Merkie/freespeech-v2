import { createEffect, createSignal, For, type ParentComponent, Show } from 'solid-js';
import { cn } from '@/lib/cn';
import { navigateToPageInProject } from '@/lib/page-actions';
import { speakText } from '@/lib/speak';
import {
	editingTilePositions,
	editingTiles,
	getCurrentPageTiles,
	localSettings,
	multiSelectMode,
	project,
	setEditingTilePositions,
	setSentence,
	speakingTilePosition,
	tilePositionKey,
	voiceEngineStatus,
} from '@/lib/state';
import type { Tile as TileType } from '@/lib/types';
import AddTileButton from './AddTileButton';
import Tile from './Tile';

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

	const handleTileClick = (tile: TileType, event: MouseEvent) => {
		const tileKey = tilePositionKey(tile);

		if (editingTiles()) {
			// In edit mode - handle selection
			if (event.shiftKey || multiSelectMode()) {
				// Shift+click or multi-select mode: toggle tile in selection
				const currentSelection = editingTilePositions();
				const isAlreadySelected = currentSelection.includes(tileKey);

				if (isAlreadySelected) {
					const newSelection = currentSelection.filter((key) => key !== tileKey);
					setEditingTilePositions(newSelection);
				} else {
					setEditingTilePositions([...currentSelection, tileKey]);
				}
			} else {
				// Regular click: select only this tile
				setEditingTilePositions([tileKey]);
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

			// With the sentence builder hidden there is nowhere for a word to queue, so a tap has to
			// speak — otherwise turning the builder off would make every tile do nothing.
			if (settings.speakOnTap || !settings.sentenceBuilder) {
				speakText(tile.text, tileKey);
			}

			if (settings.sentenceBuilder) {
				setSentence((prev) => [...prev, tile]);
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

	const isTileSelected = (tile: TileType) => {
		return editingTilePositions().includes(tilePositionKey(tile));
	};

	const isTileDimmed = (tile: TileType) => {
		if (!editingTiles()) return false;
		const selected = editingTilePositions();
		// If any tiles are selected, dim tiles that aren't selected
		if (selected.length > 0) {
			return !selected.includes(tilePositionKey(tile));
		}
		return false;
	};

	// Calculate unused coordinates for a given subpage
	const getUnusedCoords = (tiles: TileType[]) => {
		const columns = project().columns;
		const rows = project().rows;
		const usedCoords = new Set(tiles.map((t) => `${t.x},${t.y}`));

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
					<For each={tiles}>
						{(tile) => (
							<Tile
								tile={tile}
								isSelected={isTileSelected(tile)}
								isDimmed={isTileDimmed(tile)}
								isSpeaking={isTileSpeaking(tile)}
								onClick={(e) => handleTileClick(tile, e)}
							/>
						)}
					</For>

					{/* Empty tile slots - only shown in edit mode */}
					<Show when={editingTiles()}>
						<For each={getUnusedCoords(tiles)}>
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
