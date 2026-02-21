import { z } from 'zod';
import type { Request, Response } from 'express';
import { validateSchema } from '@/middleware/validate-schema';
import { authenticateRequest } from '@/middleware/authenticate-request';
import prisma from '@/resources/prisma';
import { invalidateCache } from '@/resources/cache';
import { TilePositionSchema, TileData, findTileIndexByPosition } from '@/utils/tile-types';
import { updateProjectLastEditedAt } from '@/utils/update-project-last-edited';

const schema = TilePositionSchema.extend({
	// Fields that can be updated
	text: z.string().optional(),
	displayText: z.string().optional(),
	backgroundColor: z.string().optional(),
	borderColor: z.string().optional(),
	image: z.string().optional(),
	navigation: z.string().optional(),
});

export const POST = [
	authenticateRequest(),
	validateSchema(schema),
	async (req: Request, res: Response) => {
		const body = req.body as z.infer<typeof schema>;
		const pageId = req.params.id;

		// Get the page
		const page = await prisma.tilePage.findFirst({
			where: {
				id: pageId,
				userId: req.userId,
			},
		});

		if (!page) {
			return res.status(404).json({ error: 'Page not found.' });
		}

		const tiles = (page.tiles as TileData[]) || [];

		// Find the tile by position
		const tileIndex = findTileIndexByPosition(tiles, body);
		if (tileIndex === -1) {
			return res.status(404).json({ error: 'Tile not found at specified position.' });
		}

		// Extract position and update fields
		const { x, y, page: tilePage, ...updates } = body;

		// Update tile, keeping position unchanged
		const updatedTile: TileData = {
			...tiles[tileIndex],
			...updates,
		};

		// Replace tile in array
		const updatedTiles = [...tiles];
		updatedTiles[tileIndex] = updatedTile;

		// Update page with modified tiles array
		await prisma.tilePage.update({
			where: { id: pageId },
			data: { tiles: updatedTiles },
		});

		// Update project lastEditedAt for cache invalidation
		await updateProjectLastEditedAt(pageId);

		// Invalidate cache
		invalidateCache(`page:${pageId}:${req.userId}`);

		return res.json({ success: true, tile: updatedTile });
	},
];
