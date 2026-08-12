import { For, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import { cn } from '@/lib/cn';
import { tileImageFitClass, tileTextSizeClass, tileTextWraps } from '@/lib/tile-appearance';
import { dragGhost, dragGhostPosition, dropAction } from '@/lib/tile-drag';
import type { Tile as TileType } from '@/lib/types';

// Drawn smaller than the tiles it came from, so the cells it is passing over stay visible.
const GHOST_SCALE = 0.8;
// How far each card behind the top one peeks out when the selection gathers into a stack. Sized
// to still read as a pile once the whole ghost is scaled down.
const STACK_STEP_PX = 10;
const STACK_FAN_DEG = 4;
// Past a few cards the fan stops growing, or a large selection would sprawl instead of read as a
// pile. The count badge carries the real number.
const MAX_STACK_DEPTH = 4;
// A single overshoot at the end, so the gather lands with some weight rather than easing flatly.
const STACK_EASE = 'transform 350ms cubic-bezier(0.34, 1.56, 0.64, 1)';

/**
 * The tiles that follow the pointer during a drag. Touch has no native drag image and the
 * browser's desktop one only ever shows a single element, so both platforms use this instead.
 *
 * A multi-select keeps its shape while it travels — an L stays an L — which is what makes it
 * readable as "these tiles". Over a folder's full "Add" target the tiles gather into a fanned stack,
 * previewing the pile they are about to become inside that folder. Rendered through a Portal so
 * the board's scroll container cannot clip it.
 */
export default function DragGhost() {
	// A lone tile is already its own pile, so it keeps the tilt at all times.
	const isStacked = () => dropAction() === 'add' || (dragGhost()?.count ?? 0) <= 1;

	return (
		<Show when={dragGhost()}>
			{(ghost) => (
				<Portal>
					{/* Outer element tracks the pointer every frame and must never lag behind it, so
					    nothing here transitions. The tilt and gather live on the inner element. */}
					<div
						class="pointer-events-none fixed top-0 left-0 z-50"
						style={{ transform: `translate(${dragGhostPosition().x}px, ${dragGhostPosition().y}px)` }}
					>
						{/* Scaling about the grab point leaves that exact spot under the pointer.
						    The translucency belongs here rather than on each card: as a group opacity
						    the stack composites first, so a card underneath cannot show its text
						    through the one covering it. */}
						<div
							class="opacity-90"
							style={{
								'transform-origin': `${ghost().grabOffsetX}px ${ghost().grabOffsetY}px`,
								transform: `scale(${GHOST_SCALE}) rotate(${isStacked() ? -2 : 0}deg)`,
								transition: STACK_EASE,
							}}
						>
							<For each={ghost().tiles}>
								{(item, index) => {
									const depth = () => Math.min(ghost().tiles.length - 1 - index(), MAX_STACK_DEPTH);
									const isTop = () => index() === ghost().tiles.length - 1;

									return (
										<div
											class="absolute top-0 left-0"
											style={{
												width: `${item.width}px`,
												height: `${item.height}px`,
												transform: isStacked()
													? `translate(${depth() * STACK_STEP_PX}px, ${depth() * STACK_STEP_PX}px) rotate(${depth() * STACK_FAN_DEG}deg)`
													: `translate(${item.offsetX}px, ${item.offsetY}px)`,
												transition: STACK_EASE,
											}}
										>
											<GhostFace tile={item.tile} />

											{/* Only worth showing once the tiles overlap — spread out, they count themselves. */}
											<Show when={isTop() && isStacked() && ghost().count > 1}>
												<div class="absolute -top-2 -right-2 grid h-7 min-w-7 place-items-center rounded-full bg-blue-600 px-1.5 text-sm font-bold text-white shadow-lg ring-2 ring-white">
													{ghost().count}
												</div>
											</Show>
										</div>
									);
								}}
							</For>
						</div>
					</div>
				</Portal>
			)}
		</Show>
	);
}

/** The tile's face, without any of the board's interaction wiring. */
function GhostFace(props: { tile: TileType }) {
	return (
		<div
			style={{
				'background-color': props.tile.backgroundColor ?? 'white',
				'border-color': props.tile.borderColor ?? 'black',
			}}
			class="flex h-full w-full flex-col justify-center gap-1 rounded-md border p-2 px-1 text-black shadow-2xl shadow-black/40"
		>
			<Show when={props.tile.navigation}>
				<div
					style={{ 'background-color': 'inherit', 'border-color': 'inherit' }}
					class="absolute top-[-4px] left-0 h-[10px] w-[50%] -translate-x-px rounded-t-md border border-b-0"
				/>
			</Show>

			<p
				class={cn('w-full shrink-0 text-center', tileTextSizeClass(), {
					truncate: !tileTextWraps(),
					'leading-tight break-words': tileTextWraps(),
				})}
			>
				{(props.tile.displayText || props.tile.text).trim()}
			</p>

			<Show when={props.tile.image}>
				<div class="relative min-h-0 flex-1 overflow-hidden">
					<img src={props.tile.image} alt="" class={cn('absolute inset-0 h-full w-full', tileImageFitClass())} />
				</div>
			</Show>
		</div>
	);
}
