import type { Request, Response } from 'express';
import { z } from 'zod';
import { authenticateRequest } from '@/middleware/authenticate-request';
import { validateSchema } from '@/middleware/validate-schema';
import { invalidateCache } from '@/resources/cache';
import prisma from '@/resources/prisma';
import { DEFAULT_TILE, isTilePositionOccupied, type TileData, TilePositionSchema } from '@/utils/tile-types';
import { updateProjectLastEditedAt } from '@/utils/update-project-last-edited';

const schema = TilePositionSchema.extend({
	// Optional initial values
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

		// Check if position is already occupied
		if (isTilePositionOccupied(tiles, body)) {
			return res.status(400).json({ error: 'A tile already exists at this position.' });
		}

		// Create new tile with defaults + provided values
		const newTile: TileData = {
			x: body.x,
			y: body.y,
			page: body.page,
			text: body.text ?? DEFAULT_TILE.text,
			displayText: body.displayText ?? DEFAULT_TILE.displayText,
			backgroundColor: body.backgroundColor ?? DEFAULT_TILE.backgroundColor,
			borderColor: body.borderColor ?? DEFAULT_TILE.borderColor,
			image: body.image ?? DEFAULT_TILE.image,
			navigation: body.navigation ?? DEFAULT_TILE.navigation,
		};

		// Add tile to array
		const updatedTiles = [...tiles, newTile];

		// Update page with new tiles array
		await prisma.tilePage.update({
			where: { id: pageId },
			data: { tiles: updatedTiles },
		});

		// Update project lastEditedAt for cache invalidation
		await updateProjectLastEditedAt(pageId);

		// Invalidate cache
		invalidateCache(`page:${pageId}:${req.userId}`);

		return res.json({ tile: newTile });
	},
];
