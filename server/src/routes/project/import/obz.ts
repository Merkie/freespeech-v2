import type { Request, Response } from 'express';
import { OBFPage } from '@/utils/open-board-format-types';
import { authenticateRequest } from '@/middleware/authenticate-request';
import prisma from '@/resources/prisma';
import { invalidateCache } from '@/resources/cache';
import { TileData, DEFAULT_TILE } from '@/utils/tile-types';

export const POST = [
	authenticateRequest(),
	async (req: Request, res: Response) => {
		const body = req.body as {
			obfFiles: {
				fileName: string;
				data: OBFPage;
			}[];
			manifest: { root: string };
		};

		const { obfFiles, manifest } = body;

		const rootFile = obfFiles.find((file) => file.fileName === manifest.root);
		if (!rootFile) return res.status(400).json({ error: 'Root file not found' });

		const createdProject = await prisma.project.create({
			data: {
				name: rootFile.data.name,
				description: '',
				isPublic: false,
				columns: rootFile.data.grid.columns,
				rows: rootFile.data.grid.rows,
				userId: req.userId!
			}
		});

		if (!createdProject) return res.status(500).json({ error: 'Failed to create project' });

		const obzIDToPrismaID = new Map<string, string>();
		let homePageId: string | null = null;

		// Create all tile pages concurrently (without tiles first, to build ID mapping)
		const tilePagePromises = obfFiles.map(async (file) => {
			const createdTilePage = await prisma.tilePage.create({
				data: {
					name: file.fileName === manifest.root ? 'Home' : file.data.name,
					userId: req.userId!,
					tiles: [] // Empty initially, will populate after ID mapping is complete
				}
			});
			if (!createdTilePage) throw new Error('Failed to create tile page');

			await prisma.tilePageInProject.create({
				data: {
					projectId: createdProject.id,
					tilePageId: createdTilePage.id
				}
			});

			obzIDToPrismaID.set(file.data.id, createdTilePage.id);

			// Track home page
			if (file.fileName === manifest.root) {
				homePageId = createdTilePage.id;
			}

			return createdTilePage;
		});

		try {
			await Promise.all(tilePagePromises);
		} catch (error) {
			return res.status(500).json({ error });
		}

		// Now update each page with tiles (using the ID mapping for navigation)
		const tileUpdatePromises = obfFiles.map(async (file) => {
			const pageId = obzIDToPrismaID.get(file.data.id);
			if (!pageId) return;

			// Convert OBF buttons to JSON tiles
			const tilesData: TileData[] = file.data.grid.order
				.flatMap((row, rowIndex) => {
					return row.map((item, itemIndex) => {
						if (!item) return null;

						const obfButton = file.data.buttons.find((button) => button.id === item);
						if (!obfButton) return null;

						const image = file.data.images.find((image) => image.id === obfButton.image_id)?.url || '';

						// Resolve navigation using the ID mapping
						const navigation = obfButton.load_board
							? obzIDToPrismaID.get(obfButton.load_board.id) || ''
							: '';

						return {
							x: itemIndex,
							y: rowIndex,
							page: 0,
							text: obfButton.label || DEFAULT_TILE.text,
							displayText: '',
							backgroundColor: obfButton.background_color || DEFAULT_TILE.backgroundColor,
							borderColor: obfButton.border_color || DEFAULT_TILE.borderColor,
							image,
							navigation
						} as TileData;
					});
				})
				.filter((tile): tile is TileData => tile !== null);

			// Update page with JSON tiles
			await prisma.tilePage.update({
				where: { id: pageId },
				data: { tiles: tilesData }
			});
		});

		try {
			await Promise.all(tileUpdatePromises);
		} catch (error) {
			return res.status(500).json({ error });
		}

		// Set homePageId
		if (homePageId) {
			await prisma.project.update({
				where: { id: createdProject.id },
				data: { homePageId }
			});
		}

		invalidateCache(`projects:${req.userId}`);

		return res.json({ success: true, projectId: createdProject.id });
	}
];
