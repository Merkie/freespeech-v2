import { z } from 'zod';
import type { Request, Response } from 'express';
import { validateSchema } from '@/middleware/validate-schema';
import { authenticateRequest } from '@/middleware/authenticate-request';
import prisma from '@/resources/prisma';
import { invalidateCache } from '@/resources/cache';
import { TilePositionSchema, TileData, findTileIndexByPosition } from '@/utils/tile-types';
import { updateProjectLastEditedAt } from '@/utils/update-project-last-edited';

const schema = TilePositionSchema;

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

		// Remove tile from array
		const updatedTiles = tiles.filter((_, i) => i !== tileIndex);

		// Update page with modified tiles array
		await prisma.tilePage.update({
			where: { id: pageId },
			data: { tiles: updatedTiles },
		});

		// Update project lastEditedAt for cache invalidation
		await updateProjectLastEditedAt(pageId);

		// Invalidate cache
		invalidateCache(`page:${pageId}:${req.userId}`);

		return res.json({ success: true });
	},
];
