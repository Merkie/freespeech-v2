import type { TilePosition } from './types';

export type DragGridDelta = { dx: number; dRow: number };

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
