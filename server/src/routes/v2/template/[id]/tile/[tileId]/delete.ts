import type { Request, Response } from 'express';
import { authenticateRequest } from '@/middleware/authenticate-request';
import prisma from '@/resources/prisma';
import { TileData, findTileIndexByPosition } from '@/utils/tile-types';
import { updateProjectLastEditedAt } from '@/utils/update-project-last-edited';

// Note: Route param is [tileId] for backwards compatibility, but we now use position
// The tileId param is expected to be "x-y-page" format (e.g., "0-1-0")
export const DELETE = [
	authenticateRequest(),
	async (req: Request, res: Response) => {
		// Parse position from route param (format: "x-y-page")
		const positionParts = req.params.tileId.split('-');
		if (positionParts.length !== 3) {
			return res.status(400).json({ error: 'Invalid tile position format. Expected "x-y-page".' });
		}

		const position = {
			x: parseInt(positionParts[0], 10),
			y: parseInt(positionParts[1], 10),
			page: parseInt(positionParts[2], 10),
		};

		if (isNaN(position.x) || isNaN(position.y) || isNaN(position.page)) {
			return res.status(400).json({ error: 'Invalid tile position values.' });
		}

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

		// Find tile by position
		const tileIndex = findTileIndexByPosition(tiles, position);
		if (tileIndex === -1) {
			return res.status(404).json({ error: 'Template tile not found at specified position.' });
		}

		// Remove tile
		const updatedTiles = tiles.filter((_, i) => i !== tileIndex);

		await prisma.tilePage.update({
			where: { id: req.params.id },
			data: { tiles: updatedTiles },
		});

		await updateProjectLastEditedAt(req.params.id);

		return res.json({ success: true });
	},
];
