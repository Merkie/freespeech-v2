import { type Component, For, Show } from 'solid-js';
import { cn } from '@/lib/cn';
import { tileImageFitClass, tileTextRowHeightClass, tileTextSizeClass, tileTextWraps } from '@/lib/tile-appearance';

// A one-row slice of a real board: same container (bg-zinc-100, p-2, gap-2), same tile markup
// and appearance helpers as ProjectContent's Tile. The tiles are lifted verbatim — text,
// colours, and images — from the CommuniKate 20 starter template's Home page, referencing the
// same shared template-assets URLs an imported board uses, so the preview shows exactly what
// real tiles look like. "I want to talk to you" shows truncate vs wrap; Food is a folder with
// its navigation bump.
const SAMPLE_TILES = [
	{
		text: 'I',
		backgroundColor: 'rgb(191, 140, 30)',
		borderColor: 'rgb(68, 68, 68)',
		image:
			'https://media.freespeechaac.com/template-assets/6a43848e56b3004292fe651b4d175bcbc9d67c25126cbbe5cc26c079135aedfc.webp',
	},
	{
		text: 'want',
		backgroundColor: 'rgb(255, 50, 255)',
		borderColor: 'rgb(68, 68, 68)',
		image:
			'https://media.freespeechaac.com/template-assets/21e933166c53b869343e1427a2930ae7ce877a42552c3b379ac11731153fecea.webp',
	},
	{
		text: 'I want to talk to you',
		backgroundColor: 'rgb(192, 192, 192)',
		borderColor: 'rgb(68, 68, 68)',
		image:
			'https://media.freespeechaac.com/template-assets/a9596d95ee8d076e769f30b5f63a00d9d754ea1991243a9c92e628b5800b6646.webp',
	},
	{
		text: 'Food',
		backgroundColor: 'rgb(255, 255, 50)',
		borderColor: 'rgb(68, 68, 68)',
		isFolder: true,
		image:
			'https://media.freespeechaac.com/template-assets/c1c86b3512082c6415c2083f7a25112a52d64c38e15694feb376c68d6140c356.svg',
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
