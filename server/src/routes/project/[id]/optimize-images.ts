import { PutObjectCommand } from '@aws-sdk/client-s3';
import type { Request, Response } from 'express';
import sharp from 'sharp';
import { z } from 'zod';
import { authenticateRequest } from '@/middleware/authenticate-request';
import { validateSchema } from '@/middleware/validate-schema';
import prisma from '@/resources/prisma';
import s3 from '@/resources/s3';
import { R2_BUCKET } from '@/utils/env';
import type { PageBlob } from '@/utils/project-blob';

const schema = z.object({
	dryRun: z.boolean(),
});

const MEDIA_HOST = 'media.freespeechaac.com';
const VARIANT_SUFFIX = '-512.webp';
const LEGACY_SUFFIX = '-optimized.webp';
const TARGET_SIZE = 512;
const WEBP_QUALITY = 85;

function isAlreadyProcessed(url: string): boolean {
	return url.endsWith(VARIANT_SUFFIX) || url.endsWith(LEGACY_SUFFIX);
}

interface TileWithContext {
	pageId: string;
	tileIndex: number;
	image: string;
}

export const POST = [
	authenticateRequest(),
	validateSchema(schema),
	async (req: Request, res: Response) => {
		const { dryRun } = req.body as z.infer<typeof schema>;
		const projectId = req.params.id;

		const project = await prisma.project.findFirst({
			where: { id: projectId, userId: req.userId },
		});

		if (!project) {
			return res.status(404).json({ error: 'Project not found' });
		}

		const blob = project.blob as unknown as Record<string, unknown>;
		const pages = ((blob?.pages as PageBlob[]) ?? []) as PageBlob[];

		// Collect all tiles with images
		const tilesWithImages: TileWithContext[] = [];
		for (const page of pages) {
			for (let i = 0; i < page.tiles.length; i++) {
				const tile = page.tiles[i];
				if (tile.image) {
					tilesWithImages.push({
						pageId: page.id,
						tileIndex: i,
						image: tile.image,
					});
				}
			}
		}

		// Filter to media host URLs and skip already-processed (current -512 or legacy -optimized)
		const tilesToOptimize = tilesWithImages.filter((tile) => {
			if (!tile.image.includes(MEDIA_HOST)) return false;
			if (isAlreadyProcessed(tile.image)) return false;
			return true;
		});

		if (dryRun) {
			return res.json({
				imageCount: tilesToOptimize.length,
				totalTilesWithImages: tilesWithImages.length,
				alreadyOptimized: tilesWithImages.filter((t) => isAlreadyProcessed(t.image)).length,
			});
		}

		// Perform optimization
		let optimized = 0;
		let failed = 0;
		let oldTotalSize = 0;
		let newTotalSize = 0;

		// Track updates by pageId → tileIndex → newUrl
		const updatesByPage = new Map<string, Map<number, string>>();

		for (const tile of tilesToOptimize) {
			try {
				const imageResponse = await fetch(tile.image);
				if (!imageResponse.ok) {
					failed++;
					continue;
				}

				const originalBuffer = Buffer.from(await imageResponse.arrayBuffer());
				oldTotalSize += originalBuffer.length;

				const optimizedBuffer = await sharp(originalBuffer)
					.resize(TARGET_SIZE, TARGET_SIZE, {
						fit: 'inside',
						withoutEnlargement: true,
					})
					.webp({ quality: WEBP_QUALITY })
					.toBuffer();

				newTotalSize += optimizedBuffer.length;

				const originalKey = new URL(tile.image).pathname.slice(1);
				const baseName = originalKey.replace(/\.[^.]+$/, '').replace(/-(512|original|optimized)$/i, '');
				const newKey = `${baseName}${VARIANT_SUFFIX}`;

				await s3.send(
					new PutObjectCommand({
						Bucket: R2_BUCKET,
						Key: newKey,
						Body: optimizedBuffer,
						ContentType: 'image/webp',
					}),
				);

				if (!updatesByPage.has(tile.pageId)) {
					updatesByPage.set(tile.pageId, new Map());
				}
				updatesByPage.get(tile.pageId)!.set(tile.tileIndex, `https://${MEDIA_HOST}/${newKey}`);
				optimized++;
			} catch (error) {
				console.error(`Failed to optimize image:`, error);
				failed++;
			}
		}

		// Apply updates to the blob
		if (updatesByPage.size > 0) {
			for (const page of pages) {
				const pageUpdates = updatesByPage.get(page.id);
				if (!pageUpdates) continue;
				for (const [tileIndex, newUrl] of pageUpdates) {
					page.tiles[tileIndex].image = newUrl;
				}
			}

			await prisma.project.update({
				where: { id: projectId },
				data: {
					blob: { ...blob, pages },
					lastEditedAt: new Date(),
				},
			});
		}

		return res.json({
			optimized,
			failed,
			oldTotalSize,
			newTotalSize,
			savedBytes: oldTotalSize - newTotalSize,
		});
	},
];
