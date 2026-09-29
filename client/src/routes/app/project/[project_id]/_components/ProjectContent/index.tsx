import { createEffect, createSignal, lazy, onCleanup, Show, Suspense, untrack } from 'solid-js';
import {
	boardScrollPosition,
	boardScrollReset,
	currentPageId,
	editingTilePositions,
	setBoardScrollPosition,
	usingOnlineSearch,
} from '@/lib/state';

const EditTilePanel = lazy(() => import('../EditTilePanel'));
const OnlineImageSearchPanel = lazy(() => import('../OnlineImageSearchPanel'));

import DragGhost from './DragGhost';
import TileSubpages from './TileSubpages';

export default function ProjectContent() {
	let scrollElement: HTMLDivElement | undefined;
	const [containerHeight, setContainerHeight] = createSignal(0);

	// Use a ResizeObserver to track container height
	const handleRef = (el: HTMLDivElement) => {
		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				setContainerHeight(entry.contentRect.height);
			}
		});
		observer.observe(el);
		onCleanup(() => observer.disconnect());
	};

	createEffect(() => {
		currentPageId();
		boardScrollReset();
		const height = containerHeight();
		const position = untrack(boardScrollPosition);
		requestAnimationFrame(() => {
			if (scrollElement) scrollElement.scrollTop = position * height;
		});
	});

	// Show edit panel when any tiles are selected
	const showEditPanel = () => editingTilePositions().length > 0;

	return (
		<div ref={handleRef} class="relative min-h-0 flex-1 bg-zinc-100">
			<Show when={containerHeight() > 0}>
				{/* Tile grid container */}
				{/* data-board-scroll lets a drag held near the top or bottom edge scroll this
				    container — on touch the drag owns the gesture, so swiping is not available. */}
				<div
					class="thin-scrollbar absolute inset-y-0 left-0 touch-pan-y overflow-x-hidden overflow-y-auto overscroll-contain"
					ref={scrollElement}
					onScroll={(e) => setBoardScrollPosition(e.currentTarget.scrollTop / containerHeight())}
					data-board-scroll
					style={{
						height: `${containerHeight()}px`,
						width: showEditPanel() ? 'calc(100% - 350px)' : '100%',
					}}
				>
					<TileSubpages containerHeight={containerHeight} />
				</div>

				<DragGhost />

				{/* Edit panel - shown when tiles are selected for editing */}
				<Show when={showEditPanel()}>
					<div class="absolute right-0 top-0 w-[350px]" style={{ height: `${containerHeight()}px` }}>
						<Suspense fallback={<p class="p-4">Loading editor…</p>}>
							<Show when={usingOnlineSearch()} fallback={<EditTilePanel height={containerHeight()} />}>
								<OnlineImageSearchPanel height={containerHeight()} />
							</Show>
						</Suspense>
					</div>
				</Show>
			</Show>
		</div>
	);
}
