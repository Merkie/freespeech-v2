import type { Component } from 'solid-js';
import api from '@/lib/api';
import { blobCreateTile } from '@/lib/blob-actions';
import {
	currentPageId,
	project,
	projectHomePageId,
	setEditingTilePositions,
	setPendingTileEdits,
	tilePositionKey,
} from '@/lib/state';

interface AddTileButtonProps {
	x: number;
	y: number;
	page: number;
}

const AddTileButton: Component<AddTileButtonProps> = (props) => {
	const isHomePage = () => currentPageId() === projectHomePageId();

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

		const fullTile = {
			x: tile.x,
			y: tile.y,
			page: tile.page,
			text: tile.text ?? '',
			displayText: tile.displayText ?? '',
			backgroundColor: tile.backgroundColor ?? '#fafafa',
			borderColor: tile.borderColor ?? '#71717a',
			image: tile.image ?? '',
			navigation: tile.navigation ?? '',
		};

		setEditingTilePositions([tilePositionKey(fullTile)]);
		setPendingTileEdits({
			text: fullTile.text,
			displayText: fullTile.displayText,
			image: fullTile.image,
			backgroundColor: fullTile.backgroundColor,
			borderColor: fullTile.borderColor,
			navigation: fullTile.navigation,
		});
	};

	return (
		<button
			style={{
				'grid-column-start': props.x + 1,
				'grid-row-start': props.y + 1,
			}}
			class="grid h-full w-full cursor-pointer place-items-center rounded-md border border-dashed border-zinc-500 bg-zinc-100 text-3xl font-light text-zinc-500 transition-colors hover:border-zinc-400 hover:bg-zinc-200 hover:text-zinc-600"
			onClick={handleAddTile}
		>
			<p>+</p>
		</button>
	);
};

export default AddTileButton;
