import { createSignal, Show } from 'solid-js';
import { editingTilePositions, usingOnlineSearch } from '@/lib/state';
import EditTilePanel from '../EditTilePanel';
import OnlineImageSearchPanel from '../OnlineImageSearchPanel';
import TileSubpages from './TileSubpages';

export default function ProjectContent() {
	const [containerHeight, setContainerHeight] = createSignal(0);

	// Use a ResizeObserver to track container height
	const handleRef = (el: HTMLDivElement) => {
		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				setContainerHeight(entry.contentRect.height);
			}
		});
		observer.observe(el);
	};

	// Show edit panel when any tiles are selected
	const showEditPanel = () => editingTilePositions().length > 0;

	return (
		<div ref={handleRef} class="relative flex-1 bg-zinc-100">
			<Show when={containerHeight() > 0}>
				{/* Tile grid container */}
				<div
					class="thin-scrollbar absolute overflow-auto"
					style={{
						height: `${containerHeight()}px`,
						width: showEditPanel() ? 'calc(100% - 350px)' : '100%',
					}}
				>
					<TileSubpages containerHeight={containerHeight} />
				</div>

				{/* Edit panel - shown when tiles are selected for editing */}
				<Show when={showEditPanel()}>
					<div class="absolute right-0 top-0 w-[350px]" style={{ height: `${containerHeight()}px` }}>
						<Show when={usingOnlineSearch()} fallback={<EditTilePanel height={containerHeight()} />}>
							<OnlineImageSearchPanel height={containerHeight()} />
						</Show>
					</div>
				</Show>
			</Show>
		</div>
	);
}
