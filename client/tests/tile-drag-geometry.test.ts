import { describe, expect, test } from 'bun:test';
import { dragDeltaBetween, dragGroupFits, translateDragPosition } from '../src/lib/tile-drag-geometry';
import type { TilePosition } from '../src/lib/types';

const columns = 4;
const rows = 3;

describe('tile drag geometry', () => {
	test('lets a landing footprint continue onto the next subpage', () => {
		const anchor: TilePosition = { x: 1, y: 1, page: 0 };
		const group = [anchor, { x: 1, y: 2, page: 0 }];
		const target: TilePosition = { x: 1, y: 2, page: 0 };
		const delta = dragDeltaBetween(anchor, target, rows);

		expect(dragGroupFits(group, anchor, target, columns, rows)).toBe(true);
		expect(group.map((tile) => translateDragPosition(tile, delta, columns, rows))).toEqual([
			{ x: 1, y: 2, page: 0 },
			{ x: 1, y: 0, page: 1 },
		]);
	});

	test('keeps a selection already spanning a seam together when moved upward', () => {
		const anchor: TilePosition = { x: 2, y: 2, page: 0 };
		const group = [anchor, { x: 2, y: 0, page: 1 }];
		const target: TilePosition = { x: 2, y: 1, page: 0 };
		const delta = dragDeltaBetween(anchor, target, rows);

		expect(dragGroupFits(group, anchor, target, columns, rows)).toBe(true);
		expect(group.map((tile) => translateDragPosition(tile, delta, columns, rows))).toEqual([
			{ x: 2, y: 1, page: 0 },
			{ x: 2, y: 2, page: 0 },
		]);
	});

	test('treats adjacent cells on opposite sides of a seam as one row apart', () => {
		const above: TilePosition = { x: 0, y: 2, page: 0 };
		const below: TilePosition = { x: 0, y: 0, page: 1 };

		expect(dragDeltaBetween(above, below, rows)).toEqual({ dx: 0, dRow: 1 });
		expect(dragDeltaBetween(below, above, rows)).toEqual({ dx: 0, dRow: -1 });
	});

	test('still rejects a move that would cross above the first subpage', () => {
		const anchor: TilePosition = { x: 0, y: 0, page: 1 };
		const group = [{ x: 0, y: 2, page: 0 }, anchor];
		const target: TilePosition = { x: 0, y: 0, page: 0 };

		expect(dragGroupFits(group, anchor, target, columns, rows)).toBe(false);
	});

	test('keeps horizontal wrapping while normalizing vertical seams', () => {
		const position: TilePosition = { x: 3, y: 2, page: 0 };
		const delta = { dx: 1, dRow: 1 };
		const moved = translateDragPosition(position, delta, columns, rows);

		expect(moved).toEqual({ x: 0, y: 0, page: 1 });
		expect(translateDragPosition(moved, { dx: -1, dRow: -1 }, columns, rows)).toEqual(position);
	});
});
