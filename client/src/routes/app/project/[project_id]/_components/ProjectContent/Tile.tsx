import { Show } from 'solid-js';
import { cn } from '@/lib/cn';
import { tileImageFitClass, tileTextRowHeightClass, tileTextSizeClass, tileTextWraps } from '@/lib/tile-appearance';
import type { Tile as TileType } from '@/lib/types';

export type TileProps = {
	tile: TileType;
	isSelected?: boolean;
	isDimmed?: boolean;
	isSpeaking?: boolean;
	onClick: (e: MouseEvent) => void;
};

export default function Tile(props: TileProps) {
	return (
		<div
			class="relative"
			style={{
				'grid-column-start': props.tile.x + 1,
				'grid-row-start': props.tile.y + 1,
			}}
		>
			<Show when={props.isSelected}>
				<div class="absolute top-0 left-0 h-full w-full rounded-md ring-2 ring-blue-300"></div>
				<Show when={props.tile.navigation}>
					<div
						style={{
							'background-color': 'inherit',
							'border-color': 'inherit',
						}}
						class="absolute top-[-4px] left-0 h-[10px] w-[50%] -translate-x-px rounded-t-md border border-b-0 ring-2 ring-blue-300"
					/>
				</Show>
			</Show>
			<button
				onClick={props.onClick}
				style={{
					'background-color': props.tile.backgroundColor ?? 'white',
					'border-color': props.tile.borderColor ?? 'black',
					transition: 'filter 0.1s ease-in-out, opacity 0.15s ease-in-out',
				}}
				class={cn(
					'absolute top-0 left-0 flex h-full w-full cursor-pointer flex-col justify-center gap-1 rounded-md border p-2 px-1 text-black brightness-100 hover:brightness-[102%] active:brightness-[98%]',
					{ 'opacity-40': props.isDimmed },
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
					/>
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
					<div class="relative min-h-0 flex-1 overflow-hidden">
						<img
							src={props.tile.image}
							alt={props.tile.displayText || props.tile.text}
							loading="lazy"
							decoding="async"
							class={cn('absolute inset-0 h-full w-full', tileImageFitClass())}
						/>
					</div>
				</Show>
			</button>
		</div>
	);
}
