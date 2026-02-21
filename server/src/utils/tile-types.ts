import { z } from 'zod';

/**
 * Shared tile types for position-based identification
 */

// Schema for tile data stored in TilePage.tiles JSON
export const TileDataSchema = z.object({
	x: z.number().int().min(0),
	y: z.number().int().min(0),
	page: z.number().int().min(0),
	text: z.string(),
	displayText: z.string(),
	backgroundColor: z.string(),
	borderColor: z.string(),
	image: z.string(),
	navigation: z.string(),
});

export type TileData = z.infer<typeof TileDataSchema>;

// Schema for identifying a tile by position
export const TilePositionSchema = z.object({
	x: z.number().int().min(0),
	y: z.number().int().min(0),
	page: z.number().int().min(0),
});

export type TilePosition = z.infer<typeof TilePositionSchema>;

// Default values for new tiles
export const DEFAULT_TILE: Omit<TileData, 'x' | 'y' | 'page'> = {
	text: 'New tile',
	displayText: '',
	backgroundColor: '#fafafa',
	borderColor: '#71717a',
	image: '',
	navigation: '',
};

/**
 * Find a tile by position in a tiles array
 */
export function findTileByPosition(tiles: TileData[], pos: TilePosition): TileData | undefined {
	return tiles.find((t) => t.x === pos.x && t.y === pos.y && t.page === pos.page);
}

/**
 * Find the index of a tile by position
 */
export function findTileIndexByPosition(tiles: TileData[], pos: TilePosition): number {
	return tiles.findIndex((t) => t.x === pos.x && t.y === pos.y && t.page === pos.page);
}

/**
 * Check if a position is already occupied
 */
export function isTilePositionOccupied(tiles: TileData[], pos: TilePosition): boolean {
	return tiles.some((t) => t.x === pos.x && t.y === pos.y && t.page === pos.page);
}
