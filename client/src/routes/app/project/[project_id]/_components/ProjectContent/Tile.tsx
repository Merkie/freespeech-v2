import { Show } from 'solid-js';
import { cn } from '@/lib/cn';
import { editingTiles, tilePositionKey } from '@/lib/state';
import { tileImageFitClass, tileTextRowHeightClass, tileTextSizeClass, tileTextWraps } from '@/lib/tile-appearance';
import {
	consumeDragClick,
	dragOverKey,
	folderDropSide,
	handleTilePointerDown,
	isDraggingTiles,
	isDropPreviewCell,
	isTileBeingDragged,
} from '@/lib/tile-drag';
import type { Tile as TileType } from '@/lib/types';

export type TileProps = {
	tile: TileType;
	isSelected?: boolean;
	isDimmed?: boolean;
	isSpeaking?: boolean;
	onClick: (e: MouseEvent) => void;
};

export default function Tile(props: TileProps) {
	const isFolder = () => !!props.tile.navigation;
	const isDragged = () => isTileBeingDragged(props.tile);
	const isHovered = () => isDraggingTiles() && dragOverKey() === tilePositionKey(props.tile);

	// Folders offer a choice between dropping inside and trading places, so they get the split
	// overlay instead of the plain drop ring every other tile shows.
	const showFolderOverlay = () => isHovered() && isFolder() && !isDragged();
	// Outlines every cell the drop would fill, not just the one under the pointer, so a
	// multi-select shows its whole landing footprint in the shape it is being carried in.
	const showDropRing = () => isDraggingTiles() && isDropPreviewCell(props.tile) && !showFolderOverlay();

	// A drag ends in a click on the tile it started from; without this the tile would toggle its
	// own selection the instant the user lets go.
	const handleClick = (event: MouseEvent) => {
		if (consumeDragClick()) return;
		props.onClick(event);
	};

	return (
		// The pointer handler sits on the grid cell rather than the button inside it, so the tile's
		// own click target stays exactly what it was. The cell is also its own drop target — the
		// drag hit-tests through data-drop-cell rather than relying on event bubbling.
		//
		// select-none and the callout reset stop a press-and-hold from raising iOS's text selection
		// menu over the tile being picked up. Scoped to tiles, since they are the thing tapped and
		// held — ordinary text everywhere else in the app stays selectable and copyable.
		<div
			class={cn('relative rounded-md transition-shadow select-none [-webkit-touch-callout:none]', {
				'ring-2 ring-blue-500': showDropRing(),
			})}
			style={{
				'grid-column-start': props.tile.x + 1,
				'grid-row-start': props.tile.y + 1,
			}}
			data-drop-cell={tilePositionKey(props.tile)}
			onPointerDown={(e) => handleTilePointerDown(e, props.tile)}
		>
			<Show when={props.isSelected}>
				<div class="pointer-events-none absolute top-0 left-0 h-full w-full rounded-md ring-2 ring-blue-300"></div>
				<Show when={props.tile.navigation}>
					<div
						style={{
							// Only the four pixels above the tile belong to the bump's outer edge. Letting
							// its ring continue below that join creates a blue seam through the tile.
							'clip-path': 'inset(-3px -3px 5px -3px)',
						}}
						class="pointer-events-none absolute top-[-4px] left-0 h-[10px] w-[50%] -translate-x-px rounded-t-md ring-2 ring-blue-300"
					/>
				</Show>
			</Show>
			<button
				type="button"
				onClick={handleClick}
				style={{
					'background-color': props.tile.backgroundColor ?? 'white',
					'border-color': props.tile.borderColor ?? 'black',
					transition: 'opacity 0.15s ease-in-out',
				}}
				class={cn(
					'absolute top-0 left-0 grid h-full w-full cursor-pointer rounded-md border p-2 px-1 text-black',
					{
						'grid-rows-[auto_minmax(0,1fr)] gap-1': !!props.tile.image,
						'place-items-center': !props.tile.image,
					},
					{ 'cursor-grab active:cursor-grabbing': editingTiles() },
					{ 'opacity-40': props.isDimmed || isDragged() },
					{ 'opacity-50': props.isSpeaking },
				)}
			>
				{/* Navigation bump */}
				<Show when={props.tile.navigation}>
					<div
						style={{
							'background-color': 'inherit',
							'border-color': 'inherit',
						}}
						class="absolute top-[-4px] left-0 h-[10px] w-[50%] -translate-x-px rounded-t-md border border-b-0"
					>
						{/* The bump overlaps the tile to cover the tile's top border. Mask the part of
						    its right border inside the tile so the two shapes read as one outline. */}
						<div
							style={{ 'background-color': 'inherit' }}
							class="absolute top-[5px] -right-px bottom-0 w-[2px]"
						/>
					</div>
				</Show>

				{/* Truncating keeps the label on one centred line of fixed height. Wrapping has to let
				    the row grow instead, or extra lines would be clipped by the fixed strip. */}
				<div
					class={cn('relative w-full shrink-0', tileTextSizeClass(), {
						[tileTextRowHeightClass()]: !tileTextWraps(),
						truncate: !tileTextWraps(),
					})}
				>
					<p
						class={cn('w-full text-center', {
							'absolute top-1/2 left-0 -translate-y-1/2 truncate': !tileTextWraps(),
							'leading-tight break-words': tileTextWraps(),
						})}
					>
						{(props.tile.displayText || props.tile.text).trim()}
					</p>
				</div>

				<Show when={props.tile.image}>
					{/* Keep the image in normal grid flow. The old absolute image lived inside a
					    shrinking flex item on a filtered button; WebKit could fetch and decode every
					    image yet fail to paint that composited layer on an iPad. This mirrors the
					    production Svelte renderer, which is known to work on the same device. */}
					<img
						src={props.tile.image}
						alt={props.tile.displayText || props.tile.text}
						draggable={false}
						class={cn('block h-full min-h-0 w-full min-w-0', tileImageFitClass())}
					/>
				</Show>
			</button>

			<Show when={showFolderOverlay()}>
				{/* Add / Swap drop overlay for folder tiles. Extends up over the folder "nub" so it
				    reads as one cohesive panel, and stays click-through so dragover keeps firing. */}
				<div class="pointer-events-none absolute top-[-4px] right-0 bottom-0 left-0 z-20 flex overflow-hidden rounded-md">
					<div
						class={cn(
							'flex flex-1 flex-col items-center justify-center gap-1 text-center transition-all',
							folderDropSide() === 'add'
								? 'bg-emerald-600 text-white ring-2 ring-inset ring-white'
								: 'bg-zinc-900/85 text-white/50',
						)}
					>
						<i
							class={cn('bi bi-folder-plus leading-none drop-shadow transition-transform', {
								'scale-110': folderDropSide() === 'add',
							})}
							style={{ 'font-size': 'clamp(20px, 3vw, 44px)' }}
						/>
						<span class="text-xs font-extrabold tracking-wide uppercase drop-shadow">Add</span>
					</div>
					<div class="w-0 self-stretch border-l-2 border-dashed border-white" />
					<div
						class={cn(
							'flex flex-1 flex-col items-center justify-center gap-1 text-center transition-all',
							folderDropSide() === 'swap'
								? 'bg-blue-600 text-white ring-2 ring-inset ring-white'
								: 'bg-zinc-900/85 text-white/50',
						)}
					>
						<i
							class={cn('bi bi-arrow-left-right leading-none drop-shadow transition-transform', {
								'scale-110': folderDropSide() === 'swap',
							})}
							style={{ 'font-size': 'clamp(20px, 3vw, 44px)' }}
						/>
						<span class="text-xs font-extrabold tracking-wide uppercase drop-shadow">Swap</span>
					</div>
				</div>
			</Show>
		</div>
	);
}
