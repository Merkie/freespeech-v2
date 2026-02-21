import type { Request, Response } from 'express';
import { authenticateRequest } from '@/middleware/authenticate-request';
import { validateSchema } from '@/middleware/validate-schema';
import { z } from 'zod';
import sharp from 'sharp';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import s3 from '@/resources/s3';
import prisma from '@/resources/prisma';
import { R2_BUCKET } from '@/utils/env';
import { TileData } from '@/utils/tile-types';
import { updateProjectLastEditedAt } from '@/utils/update-project-last-edited';

const schema = z.object({
	dryRun: z.boolean()
});

const MEDIA_HOST = 'media.freespeechaac.com';
const OPTIMIZED_SUFFIX = '-optimized.webp';
const TARGET_SIZE = 250;
const WEBP_QUALITY = 80;

// Type for tracking tile positions in pages
interface TileWithContext {
	pageId: string;
	x: number;
	y: number;
	page: number;
	image: string;
}

export const POST = [
	authenticateRequest(),
	validateSchema(schema),
	async (req: Request, res: Response) => {
		const { dryRun } = req.body as z.infer<typeof schema>;
		const projectId = req.params.id;

		// Verify project ownership
		const project = await prisma.project.findFirst({
			where: {
				id: projectId,
				userId: req.userId
			},
			include: {
				connectedPages: {
					include: {
						tilePage: true
					}
				}
			}
		});

		if (!project) {
			return res.status(404).json({ error: 'Project not found' });
		}

		// Collect all tiles with images from all pages in the project
		const tilesWithImages: TileWithContext[] = [];
		for (const conn of project.connectedPages) {
			const tiles = (conn.tilePage.tiles as TileData[]) || [];
			for (const tile of tiles) {
				if (tile.image) {
					tilesWithImages.push({
						pageId: conn.tilePageId,
						x: tile.x,
						y: tile.y,
						page: tile.page,
						image: tile.image
					});
				}
			}
		}

		// Filter to only media.freespeechaac.com URLs and skip already-optimized images
		const tilesToOptimize = tilesWithImages.filter((tile) => {
			if (!tile.image.includes(MEDIA_HOST)) return false;
			if (tile.image.endsWith(OPTIMIZED_SUFFIX)) return false;
			return true;
		});

		if (dryRun) {
			return res.json({
				imageCount: tilesToOptimize.length,
				totalTilesWithImages: tilesWithImages.length,
				alreadyOptimized: tilesWithImages.filter((t) => t.image.endsWith(OPTIMIZED_SUFFIX)).length
			});
		}

		// Perform optimization
		let optimized = 0;
		let failed = 0;
		let oldTotalSize = 0;
		let newTotalSize = 0;

		// Group updates by page for efficient batch updates
		const updatesByPage = new Map<string, { x: number; y: number; page: number; newUrl: string }[]>();

		for (const tile of tilesToOptimize) {
			try {
				// Fetch the original image
				const imageResponse = await fetch(tile.image);
				if (!imageResponse.ok) {
					console.error(`Failed to fetch image for tile at (${tile.x},${tile.y}) on page ${tile.pageId}: ${imageResponse.status}`);
					failed++;
					continue;
				}

				const originalBuffer = Buffer.from(await imageResponse.arrayBuffer());
				oldTotalSize += originalBuffer.length;

				// Convert with Sharp: resize to fit within TARGET_SIZE, WebP quality
				const optimizedBuffer = await sharp(originalBuffer)
					.resize(TARGET_SIZE, TARGET_SIZE, {
						fit: 'inside',
						withoutEnlargement: true
					})
					.webp({ quality: WEBP_QUALITY })
					.toBuffer();

				newTotalSize += optimizedBuffer.length;

				// Generate new key with -optimized.webp suffix
				const originalKey = new URL(tile.image).pathname.slice(1);
				const baseName = originalKey.replace(/\.[^.]+$/, '');
				const newKey = `${baseName}${OPTIMIZED_SUFFIX}`;

				// Upload to R2
				await s3.send(
					new PutObjectCommand({
						Bucket: R2_BUCKET,
						Key: newKey,
						Body: optimizedBuffer,
						ContentType: 'image/webp'
					})
				);

				// Track update for this page
				if (!updatesByPage.has(tile.pageId)) {
					updatesByPage.set(tile.pageId, []);
				}
				updatesByPage.get(tile.pageId)!.push({
					x: tile.x,
					y: tile.y,
					page: tile.page,
					newUrl: `https://${MEDIA_HOST}/${newKey}`
				});
				optimized++;
			} catch (error) {
				console.error(`Failed to optimize image for tile at (${tile.x},${tile.y}) on page ${tile.pageId}:`, error);
				failed++;
			}
		}

		// Apply updates to each page's JSON tiles
		for (const [pageId, updates] of updatesByPage) {
			const tilePage = await prisma.tilePage.findUnique({
				where: { id: pageId }
			});

			if (!tilePage) continue;

			const tiles = (tilePage.tiles as TileData[]) || [];

			// Apply updates
			for (const update of updates) {
				const tileIndex = tiles.findIndex(
					(t) => t.x === update.x && t.y === update.y && t.page === update.page
				);
				if (tileIndex !== -1) {
					tiles[tileIndex].image = update.newUrl;
				}
			}

			// Save updated tiles
			await prisma.tilePage.update({
				where: { id: pageId },
				data: { tiles }
			});

			// Update project lastEditedAt
			await updateProjectLastEditedAt(pageId);
		}

		return res.json({
			optimized,
			failed,
			oldTotalSize,
			newTotalSize,
			savedBytes: oldTotalSize - newTotalSize
		});
	}
];
