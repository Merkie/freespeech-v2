import { z } from 'zod';
import type { Request, Response } from 'express';
import { validateSchema } from '@/middleware/validate-schema';
import { authenticateRequest } from '@/middleware/authenticate-request';
import prisma from '@/resources/prisma';
import { invalidateCache } from '@/resources/cache';
import {
	TilePositionSchema,
	TileData,
	DEFAULT_TILE,
	findTileIndexByPosition,
	isTilePositionOccupied,
} from '@/utils/tile-types';
import { updateProjectLastEditedAt } from '@/utils/update-project-last-edited';

// Operation types for batch processing
const CreateOperationSchema = z.object({
	type: z.literal('create'),
	position: TilePositionSchema,
	data: z
		.object({
			text: z.string().optional(),
			displayText: z.string().optional(),
			backgroundColor: z.string().optional(),
			borderColor: z.string().optional(),
			image: z.string().optional(),
			navigation: z.string().optional(),
		})
		.optional(),
});

const UpdateOperationSchema = z.object({
	type: z.literal('update'),
	position: TilePositionSchema,
	data: z.object({
		text: z.string().optional(),
		displayText: z.string().optional(),
		backgroundColor: z.string().optional(),
		borderColor: z.string().optional(),
		image: z.string().optional(),
		navigation: z.string().optional(),
	}),
});

const DeleteOperationSchema = z.object({
	type: z.literal('delete'),
	position: TilePositionSchema,
});

const OperationSchema = z.discriminatedUnion('type', [
	CreateOperationSchema,
	UpdateOperationSchema,
	DeleteOperationSchema,
]);

const schema = z.object({
	operations: z.array(OperationSchema).min(1).max(100),
});

type Operation = z.infer<typeof OperationSchema>;

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

		let tiles = (page.tiles as TileData[]) || [];
		const results: { success: boolean; operation: Operation; error?: string }[] = [];

		// Process operations in order
		for (const operation of body.operations) {
			try {
				switch (operation.type) {
					case 'create': {
						if (isTilePositionOccupied(tiles, operation.position)) {
							results.push({
								success: false,
								operation,
								error: 'Position already occupied',
							});
							continue;
						}

						const newTile: TileData = {
							x: operation.position.x,
							y: operation.position.y,
							page: operation.position.page,
							text: operation.data?.text ?? DEFAULT_TILE.text,
							displayText: operation.data?.displayText ?? DEFAULT_TILE.displayText,
							backgroundColor: operation.data?.backgroundColor ?? DEFAULT_TILE.backgroundColor,
							borderColor: operation.data?.borderColor ?? DEFAULT_TILE.borderColor,
							image: operation.data?.image ?? DEFAULT_TILE.image,
							navigation: operation.data?.navigation ?? DEFAULT_TILE.navigation,
						};

						tiles = [...tiles, newTile];
						results.push({ success: true, operation });
						break;
					}

					case 'update': {
						const tileIndex = findTileIndexByPosition(tiles, operation.position);
						if (tileIndex === -1) {
							results.push({
								success: false,
								operation,
								error: 'Tile not found',
							});
							continue;
						}

						tiles[tileIndex] = {
							...tiles[tileIndex],
							...operation.data,
						};
						results.push({ success: true, operation });
						break;
					}

					case 'delete': {
						const tileIndex = findTileIndexByPosition(tiles, operation.position);
						if (tileIndex === -1) {
							results.push({
								success: false,
								operation,
								error: 'Tile not found',
							});
							continue;
						}

						tiles = tiles.filter((_, i) => i !== tileIndex);
						results.push({ success: true, operation });
						break;
					}
				}
			} catch (error) {
				results.push({
					success: false,
					operation,
					error: error instanceof Error ? error.message : 'Unknown error',
				});
			}
		}

		// Update page with modified tiles array
		await prisma.tilePage.update({
			where: { id: pageId },
			data: { tiles },
		});

		// Update project lastEditedAt for cache invalidation
		await updateProjectLastEditedAt(pageId);

		// Invalidate cache
		invalidateCache(`page:${pageId}:${req.userId}`);

		const successCount = results.filter((r) => r.success).length;
		const failCount = results.filter((r) => !r.success).length;

		return res.json({
			success: failCount === 0,
			processed: results.length,
			succeeded: successCount,
			failed: failCount,
			results,
			tiles, // Return updated tiles array
		});
	},
];
