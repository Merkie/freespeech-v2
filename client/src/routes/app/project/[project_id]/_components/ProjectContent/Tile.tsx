import { Show } from 'solid-js';
import { cn } from '@/lib/cn';
import { editingTiles, tilePositionKey } from '@/lib/state';
import { tileImageFitClass, tileTextRowHeightClass, tileTextSizeClass, tileTextWraps } from '@/lib/tile-appearance';
import {
	consumeDragClick,
	dragOverKey,
	dropAction,
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

	// A folder stays visible as a folder while it is targeted. Its green silhouette and small
	// folder-plus badge distinguish "move inside" from the board's blue landing preview.
	const showFolderAddTarget = () => isHovered() && isFolder() && !isDragged() && dropAction() === 'add';
	// Outlines every cell the drop would fill, not just the one under the pointer, so a
	// multi-select shows its whole landing footprint in the shape it is being carried in.
	const showDropPreview = () => isDraggingTiles() && isDropPreviewCell(props.tile) && !showFolderAddTarget();

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
				'ring-2 ring-blue-300': showDropPreview(),
			})}
			style={{
				'grid-column-start': props.tile.x + 1,
				'grid-row-start': props.tile.y + 1,
			}}
			data-drop-cell={tilePositionKey(props.tile)}
			onPointerDown={(e) => handleTilePointerDown(e, props.tile)}
			onClick={handleClick}
		>
			<Show when={props.isSelected}>
				{/* A filled silhouette behind the tile produces one continuous outline. Separate
				    rings around the tile and bump either overlap or leave a gap at their join.

				    The tight top-left corner is only for folders: it is where the navigation bump
				    meets the tile, and squaring it off is what lets the two read as one shape. A tile
				    with no bump has nothing joining it there, so it keeps the uniform 8px radius. */}
				<div
					class={cn('pointer-events-none absolute -inset-0.5 rounded-[8px] bg-blue-300', {
						'rounded-tl-sm': isFolder(),
					})}
				></div>
				<Show when={props.tile.navigation}>
					<div class="pointer-events-none absolute top-[-6px] left-[-2px] h-[8px] w-[calc(50%+4px)] rounded-t-[8px] bg-blue-300" />
				</Show>
			</Show>

			<Show when={showFolderAddTarget()}>
				{/* Sit behind the opaque folder rather than over it. The two pieces trace the body and
				    navigation bump as one soft green target while leaving its label and picture readable. */}
				<div class="folder-add-target-in pointer-events-none absolute inset-0">
					<div class="absolute -inset-1 rounded-[10px] bg-emerald-300 shadow-[0_0_14px_rgba(52,211,153,0.55)]" />
					<div class="absolute top-[-8px] left-[-4px] h-[12px] w-[calc(50%+8px)] rounded-t-[10px] bg-emerald-300 shadow-[0_0_14px_rgba(52,211,153,0.55)]" />
				</div>
			</Show>

			{/* Fade the opaque tile and bump as one composited shape. Dimming or pulsing them
			    separately would make their overlap show through at the top edge. */}
			<div
				class={cn('absolute inset-0 transition-opacity', {
					'opacity-40': props.isDimmed && !isDragged(),
					'opacity-50': props.isSpeaking,
					'tile-drag-origin-pulse': isDragged(),
				})}
			>
				<button
					type="button"
					style={{
						'background-color': props.tile.backgroundColor ?? 'white',
						'border-color': props.tile.borderColor ?? 'black',
					}}
					class={cn(
						'absolute top-0 left-0 grid h-full w-full cursor-pointer rounded-md border p-2 px-1 text-black',
						{
							'grid-rows-[auto_minmax(0,1fr)] gap-1': !!props.tile.image,
							'place-items-center': !props.tile.image,
						},
						{ 'cursor-grab active:cursor-grabbing': editingTiles() },
					)}
				>
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

				{/* Paint the bump above the button so it covers the button's rounded top-left corner
				    and visibly extends below the tile's top edge. */}
				<Show when={props.tile.navigation}>
					<div
						style={{
							'background-color': props.tile.backgroundColor ?? 'white',
							'border-color': props.tile.borderColor ?? 'black',
						}}
						class={cn('absolute top-[-4px] left-0 z-10 h-[10px] w-[50%] rounded-t-md border border-b-0', {
							'cursor-grab active:cursor-grabbing': editingTiles(),
						})}
					/>
				</Show>
			</div>

			<Show when={showDropPreview()}>
				{/* The translucent fill makes every landing cell visible through the lifted ghost, like
				    the landing projection in a block puzzle. */}
				<div class="pointer-events-none absolute inset-0 z-20 rounded-md border-2 border-blue-300 bg-blue-200/50 shadow-[inset_0_0_0_2px_rgba(255,255,255,0.7)]" />
			</Show>

			<Show when={showFolderAddTarget()}>
				{/* The gathering drag ghost already communicates the motion, so a compact icon is enough
				    confirmation without covering the folder with a redundant Add label. */}
				<div class="folder-add-badge-in pointer-events-none absolute -top-2 -right-2 z-20 grid h-8 w-8 place-items-center rounded-full bg-emerald-500 text-white shadow-lg ring-2 ring-white">
					<i class="bi bi-folder-plus text-base leading-none" />
				</div>
			</Show>
		</div>
	);
}
