import { type Component, For, Show } from 'solid-js';
import { cn } from '@/lib/cn';
import { tileImageFitClass, tileTextRowHeightClass, tileTextSizeClass, tileTextWraps } from '@/lib/tile-appearance';

// A one-row slice of a real board: same container (bg-zinc-100, p-2, gap-2), same tile markup
// and appearance helpers as ProjectContent's Tile, colours from the edit panel's palette, and a
// folder tile complete with its navigation bump. Images are inline SVGs (no network, works
// offline), square so Contain pillarboxes and Cover visibly crops in the wider-than-tall image
// area. One long label shows the difference between truncating and wrapping.
const svg = (body: string) =>
	`data:image/svg+xml,${encodeURIComponent(
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">${body}</svg>`,
	)}`;

const SAMPLE_TILES = [
	{
		text: 'I',
		backgroundColor: '#fef9c3',
		borderColor: '#eab308',
		image: svg(
			'<circle cx="60" cy="32" r="18" fill="#3f3f46"/><path d="M60 56c-22 0-32 15-32 36v16h64V92c0-21-10-36-32-36z" fill="#3f3f46"/>',
		),
	},
	{
		text: 'want',
		backgroundColor: '#dcfce7',
		borderColor: '#22c55e',
		image: svg(
			'<rect x="40" y="24" width="10" height="44" rx="5" fill="#3f3f46"/><rect x="54" y="16" width="10" height="52" rx="5" fill="#3f3f46"/><rect x="68" y="22" width="10" height="46" rx="5" fill="#3f3f46"/><rect x="82" y="32" width="9" height="36" rx="4.5" fill="#3f3f46"/><path d="M36 62h56v20c0 14-12 24-28 24S36 96 36 82z" fill="#3f3f46"/><rect x="22" y="56" width="22" height="11" rx="5.5" fill="#3f3f46" transform="rotate(28 22 56)"/>',
		),
	},
	{
		text: 'more crackers please',
		backgroundColor: '#ffedd5',
		borderColor: '#f97316',
		image: svg(
			'<rect width="120" height="120" fill="#fde68a"/><rect x="14" y="14" width="92" height="92" rx="14" fill="#fbbf24" stroke="#d97706" stroke-width="4"/><circle cx="42" cy="42" r="5" fill="#b45309"/><circle cx="78" cy="42" r="5" fill="#b45309"/><circle cx="42" cy="78" r="5" fill="#b45309"/><circle cx="78" cy="78" r="5" fill="#b45309"/><circle cx="60" cy="60" r="5" fill="#b45309"/>',
		),
	},
	{
		text: 'food',
		backgroundColor: '#dbeafe',
		borderColor: '#3b82f6',
		isFolder: true,
		image: svg(
			'<circle cx="46" cy="70" r="32" fill="#ef4444"/><circle cx="74" cy="70" r="32" fill="#ef4444"/><rect x="56" y="22" width="7" height="20" rx="3.5" fill="#92400e"/><ellipse cx="76" cy="28" rx="14" ry="8" fill="#22c55e" transform="rotate(-25 76 28)"/>',
		),
	},
];

const TilePreview: Component = () => {
	return (
		<div class="overflow-hidden rounded-xl border border-zinc-200">
			<div class="grid grid-cols-4 gap-2 bg-zinc-100 p-2">
				<For each={SAMPLE_TILES}>
					{(tile) => (
						// Same cell + tile structure as the board's Tile component, with a fixed height
						// standing in for the board grid's row sizing. Not a button: nothing to tap.
						<div class="relative h-24 rounded-md sm:h-32">
							<div
								style={{ 'background-color': tile.backgroundColor, 'border-color': tile.borderColor }}
								class="absolute top-0 left-0 grid h-full w-full grid-rows-[auto_minmax(0,1fr)] gap-1 rounded-md border p-2 px-1 text-black"
							>
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
										{tile.text}
									</p>
								</div>
								<img
									src={tile.image}
									alt=""
									draggable={false}
									class={cn('block h-full min-h-0 w-full min-w-0', tileImageFitClass())}
								/>
							</div>
							<Show when={tile.isFolder}>
								<div
									style={{ 'background-color': tile.backgroundColor, 'border-color': tile.borderColor }}
									class="absolute top-[-4px] left-0 z-10 h-[10px] w-[50%] rounded-t-md border border-b-0"
								/>
							</Show>
						</div>
					)}
				</For>
			</div>
		</div>
	);
};

export default TilePreview;
