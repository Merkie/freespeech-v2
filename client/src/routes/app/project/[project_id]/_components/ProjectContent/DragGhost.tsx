import { Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import { cn } from '@/lib/cn';
import { tileImageFitClass, tileTextSizeClass, tileTextWraps } from '@/lib/tile-appearance';
import { dragGhost, dragGhostPosition } from '@/lib/tile-drag';

/**
 * The tile that follows the pointer during a drag. Touch has no native drag image, and the
 * browser's desktop one cannot show how many tiles a multi-select is carrying — so both platforms
 * use this instead. Rendered through a Portal so the board's scroll container cannot clip it.
 */
export default function DragGhost() {
	return (
		<Show when={dragGhost()}>
			{(ghost) => (
				<Portal>
					<div
						class="pointer-events-none fixed top-0 left-0 z-50"
						style={{
							width: `${ghost().width}px`,
							height: `${ghost().height}px`,
							transform: `translate(${dragGhostPosition().x}px, ${dragGhostPosition().y}px) scale(1.05) rotate(-2deg)`,
						}}
					>
						<div
							style={{
								'background-color': ghost().tile.backgroundColor ?? 'white',
								'border-color': ghost().tile.borderColor ?? 'black',
							}}
							class="flex h-full w-full flex-col justify-center gap-1 rounded-md border p-2 px-1 text-black opacity-90 shadow-2xl shadow-black/40"
						>
							<Show when={ghost().tile.navigation}>
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
								{(ghost().tile.displayText || ghost().tile.text).trim()}
							</p>

							<Show when={ghost().tile.image}>
								<div class="relative min-h-0 flex-1 overflow-hidden">
									<img
										src={ghost().tile.image}
										alt=""
										class={cn('absolute inset-0 h-full w-full', tileImageFitClass())}
									/>
								</div>
							</Show>
						</div>

						{/* Multi-select carries the rest of the selection invisibly, so it gets a count. */}
						<Show when={ghost().count > 1}>
							<div class="absolute -top-2 -right-2 grid h-7 min-w-7 place-items-center rounded-full bg-blue-600 px-1.5 text-sm font-bold text-white shadow-lg ring-2 ring-white">
								{ghost().count}
							</div>
						</Show>
					</div>
				</Portal>
			)}
		</Show>
	);
}
