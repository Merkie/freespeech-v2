import { type Component, For } from 'solid-js';
import { cn } from '@/lib/cn';
import { tileImageFitClass, tileTextRowHeightClass, tileTextSizeClass, tileTextWraps } from '@/lib/tile-appearance';

// Sample tiles drawn with the same markup and appearance helpers as the real board, so the
// preview cannot drift from what boards actually render. Images are inline SVGs (no network,
// works offline) and are square on purpose while the tile's image area is wider than tall:
// Contain pillarboxes them and Cover visibly crops the top and bottom, so the image-fit choice
// shows at a glance. One long label shows the difference between truncating and wrapping.
const svg = (body: string) =>
	`data:image/svg+xml,${encodeURIComponent(
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">${body}</svg>`,
	)}`;

const SAMPLE_TILES = [
	{
		text: 'play outside',
		image: svg(
			'<rect width="120" height="120" fill="#bae6fd"/><circle cx="90" cy="28" r="16" fill="#fde047"/><ellipse cx="30" cy="128" rx="68" ry="48" fill="#86efac"/><ellipse cx="102" cy="134" rx="58" ry="42" fill="#4ade80"/>',
		),
	},
	{
		text: 'more crackers please',
		image: svg(
			'<rect width="120" height="120" fill="#fef3c7"/><rect x="25" y="25" width="70" height="70" rx="10" fill="#fbbf24"/><circle cx="45" cy="47" r="4" fill="#b45309"/><circle cx="75" cy="47" r="4" fill="#b45309"/><circle cx="45" cy="73" r="4" fill="#b45309"/><circle cx="75" cy="73" r="4" fill="#b45309"/>',
		),
	},
	{
		text: 'happy',
		image: svg(
			'<rect width="120" height="120" fill="#fce7f3"/><circle cx="60" cy="60" r="40" fill="#fde047" stroke="#eab308" stroke-width="3"/><circle cx="47" cy="50" r="5" fill="#422006"/><circle cx="73" cy="50" r="5" fill="#422006"/><path d="M42 68 Q60 86 78 68" fill="none" stroke="#422006" stroke-width="4" stroke-linecap="round"/>',
		),
	},
];

const TilePreview: Component = () => {
	return (
		<div class="rounded-xl border border-zinc-200 bg-zinc-50 p-4 sm:p-5">
			<div class="mx-auto grid max-w-md grid-cols-3 gap-3">
				<For each={SAMPLE_TILES}>
					{(tile) => (
						// Fixed height with clipping, because board cells get their size from the grid —
						// a tile can never grow to fit a long wrapped label, only give up image room.
						<div
							style={{ 'background-color': '#fafafa', 'border-color': '#71717a' }}
							class="grid h-36 grid-rows-[auto_minmax(0,1fr)] gap-1 overflow-hidden rounded-md border p-2 px-1 text-black"
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
					)}
				</For>
			</div>
		</div>
	);
};

export default TilePreview;
