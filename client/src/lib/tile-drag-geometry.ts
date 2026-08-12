import type { Tile, TilePosition } from './types';

export type DragGridDelta = { dx: number; dRow: number };
export type DropAction = 'add' | 'swap' | null;

/**
 * Drop actions are directional. Anything carried onto a folder is added to its page; Swap is
 * offered only for the reverse gesture of carrying one folder onto a regular tile.
 */
export function resolveDropAction(
	group: readonly Pick<Tile, 'navigation'>[],
	occupant: Pick<Tile, 'navigation'> | null,
	occupantIsDragged: boolean,
): DropAction {
	if (!occupant || occupantIsDragged) return null;
	if (occupant.navigation) return 'add';
	return group.length === 1 && !!group[0]?.navigation ? 'swap' : null;
}

/** Reading order across the board: left-to-right, then top-to-bottom, then later subpages. */
export function compareTilePositions(a: TilePosition, b: TilePosition): number {
	return a.page - b.page || a.y - b.y || a.x - b.x;
}

/**
 * Returns the first `count` empty cells in reading order. Folder drops deliberately use this
 * instead of translating the dragged footprint: an L-shaped selection becomes a simple sequence
 * of tiles packed into the destination's earliest openings.
 */
export function findFirstAvailableSlots(
	isOccupied: (position: TilePosition) => boolean,
	count: number,
	columns: number,
	rows: number,
): TilePosition[] {
	if (count <= 0 || columns <= 0 || rows <= 0) return [];

	const slots: TilePosition[] = [];
	for (let page = 0; slots.length < count; page++) {
		for (let y = 0; y < rows && slots.length < count; y++) {
			for (let x = 0; x < columns && slots.length < count; x++) {
				const position = { x, y, page };
				if (!isOccupied(position)) slots.push(position);
			}
		}
	}

	return slots;
}

/**
 * Subpages are consecutive slices of one vertical grid. Flattening `(page, y)` into one row
 * makes a one-row drag across a seam stay a one-row drag instead of becoming a page jump plus an
 * out-of-bounds local row.
 */
export function dragDeltaBetween(anchor: TilePosition, cell: TilePosition, rows: number): DragGridDelta {
	return {
		dx: cell.x - anchor.x,
		dRow: cell.page * rows + cell.y - (anchor.page * rows + anchor.y),
	};
}

function wrapColumn(x: number, columns: number): number {
	if (columns <= 0) return x;
	return ((x % columns) + columns) % columns;
}

/** Translate a cell while normalizing vertical overflow onto the neighboring subpage. */
export function translateDragPosition(
	position: TilePosition,
	delta: DragGridDelta,
	columns: number,
	rows: number,
): TilePosition {
	const globalRow = position.page * rows + position.y + delta.dRow;
	return {
		x: wrapColumn(position.x + delta.dx, columns),
		y: ((globalRow % rows) + rows) % rows,
		page: Math.floor(globalRow / rows),
	};
}

/** The board can grow downward indefinitely, but a group cannot move above its first subpage. */
export function dragGroupFits(
	group: TilePosition[],
	anchor: TilePosition | null,
	cell: TilePosition,
	columns: number,
	rows: number,
): boolean {
	if (!anchor || group.length === 0 || columns <= 0 || rows <= 0) return false;

	const delta = dragDeltaBetween(anchor, cell, rows);
	return group.every((tile) => translateDragPosition(tile, delta, columns, rows).page >= 0);
}
