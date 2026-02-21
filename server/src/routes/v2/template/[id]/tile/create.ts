import type { Request, Response } from 'express';
import { z } from 'zod';
import { authenticateRequest } from '@/middleware/authenticate-request';
import { validateSchema } from '@/middleware/validate-schema';
import prisma from '@/resources/prisma';
import { TileData, TilePositionSchema, DEFAULT_TILE, isTilePositionOccupied } from '@/utils/tile-types';
import { updateProjectLastEditedAt } from '@/utils/update-project-last-edited';

const schema = TilePositionSchema.extend({
	text: z.string().optional(),
	backgroundColor: z.string().optional(),
	borderColor: z.string().optional(),
	image: z.string().optional(),
	navigation: z.string().optional(),
	displayText: z.string().optional(),
});

export const POST = [
	authenticateRequest(),
	validateSchema(schema),
	async (req: Request, res: Response) => {
		const body = req.body as z.infer<typeof schema>;

		// Templates are TilePages with isTemplate: true
		const template = await prisma.tilePage.findFirst({
			where: {
				id: req.params.id,
				userId: req.userId,
				isTemplate: true,
			},
		});

		if (!template) {
			return res.status(404).json({ error: 'Template not found.' });
		}

		const tiles = (template.tiles as TileData[]) || [];

		// Check if tile already exists at position
		if (isTilePositionOccupied(tiles, body)) {
			return res.status(400).json({ error: 'A tile already exists at this position.' });
		}

		// Create new tile
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

		// Add to tiles array
		const updatedTiles = [...tiles, newTile];

		await prisma.tilePage.update({
			where: { id: req.params.id },
			data: { tiles: updatedTiles },
		});

		await updateProjectLastEditedAt(req.params.id);

		return res.json({ tile: newTile });
	},
];
