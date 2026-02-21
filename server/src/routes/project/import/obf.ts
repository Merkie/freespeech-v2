import type { Request, Response } from 'express';
import { authenticateRequest } from '@/middleware/authenticate-request';
import { invalidateCache } from '@/resources/cache';
import prisma from '@/resources/prisma';
import type { OBFPage } from '@/utils/open-board-format-types';
import { DEFAULT_TILE, type TileData } from '@/utils/tile-types';

export const POST = [
	authenticateRequest(),
	async (req: Request, res: Response) => {
		const page = req.body as OBFPage;

		const name = page.name;
		const columns = page.grid.columns;
		const rows = page.grid.rows;

		if (!name || !columns || !rows) return res.status(400).json({ error: 'Invalid request body' });

		const createdProject = await prisma.project.create({
			data: {
				name,
				description: '',
				isPublic: false,
				columns,
				rows,
				userId: req.userId!,
			},
		});
		if (!createdProject) return res.status(500).json({ error: 'Failed to create project' });

		// Convert OBF buttons to JSON tiles
		const tilesData: TileData[] = page.grid.order
			.flatMap((row, rowIndex) => {
				return row.map((item, itemIndex) => {
					if (!item) return null;

					const obfButton = page.buttons.find((button) => button.id === item);
					if (!obfButton) return null;

					const image = page.images.find((image) => image.id === obfButton.image_id)?.url || '';

					return {
						x: itemIndex,
						y: rowIndex,
						page: 0,
						text: obfButton.label || DEFAULT_TILE.text,
						displayText: '',
						backgroundColor: obfButton.background_color || DEFAULT_TILE.backgroundColor,
						borderColor: obfButton.border_color || DEFAULT_TILE.borderColor,
						image,
						navigation: '',
					} as TileData;
				});
			})
			.filter((tile): tile is TileData => tile !== null);

		// Create home page with JSON tiles
		const createdHomepage = await prisma.tilePage.create({
			data: {
				name: 'Home',
				userId: req.userId!,
				tiles: tilesData,
			},
		});
		if (!createdHomepage) return res.status(500).json({ error: 'Failed to create tile page' });

		await prisma.tilePageInProject.create({
			data: {
				projectId: createdProject.id,
				tilePageId: createdHomepage.id,
			},
		});

		// Set homePageId
		await prisma.project.update({
			where: { id: createdProject.id },
			data: { homePageId: createdHomepage.id },
		});

		invalidateCache(`projects:${req.userId}`);

		return res.json({ success: true, projectId: createdProject.id });
	},
];
