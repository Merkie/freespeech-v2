import type { Component } from 'solid-js';
import api from '@/lib/api';
import { blobCreateTile } from '@/lib/blob-actions';
import { cn } from '@/lib/cn';
import { currentPageId, project, projectHomePageId, setEditingTilePositions, tilePositionKey } from '@/lib/state';
import { isDraggingTiles, isDropPreviewCell } from '@/lib/tile-drag';

interface AddTileButtonProps {
	x: number;
	y: number;
	page: number;
}

const AddTileButton: Component<AddTileButtonProps> = (props) => {
	const isHomePage = () => currentPageId() === projectHomePageId();
	const cell = () => ({ x: props.x, y: props.y, page: props.page });
	const isDropTarget = () => isDraggingTiles() && isDropPreviewCell(cell());

	const handleAddTile = () => {
		const pid = currentPageId();
		if (!pid) return;

		// Create tile via blob mutation — instant, no network call
		const tile = blobCreateTile(pid, {
			x: props.x,
			y: props.y,
			page: props.page,
		});

		if (isHomePage()) {
			void api.project.updateThumbnail(project()?.id || '');
		}

		setEditingTilePositions([tilePositionKey({ x: tile.x, y: tile.y, page: tile.page })]);
	};

	return (
		<button
			style={{
				'grid-column-start': props.x + 1,
				'grid-row-start': props.y + 1,
			}}
			class={cn(
				'grid h-full w-full cursor-pointer place-items-center rounded-md border border-dashed border-zinc-500 bg-zinc-100 text-3xl font-light text-zinc-500 transition-colors hover:border-zinc-400 hover:bg-zinc-200 hover:text-zinc-600',
				{ 'border-blue-500 bg-blue-100 ring-2 ring-blue-500': isDropTarget() },
			)}
			onClick={handleAddTile}
			data-drop-cell={tilePositionKey(cell())}
		>
			<p>+</p>
		</button>
	);
};

export default AddTileButton;
