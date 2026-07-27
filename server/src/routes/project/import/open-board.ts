import express, { type Request, type Response } from 'express';
import { authenticateRequest } from '@/middleware/authenticate-request';
import { userImportAssetStore } from '@/resources/asset-store';
import { invalidateCache } from '@/resources/cache';
import prisma from '@/resources/prisma';
import { buildProjectFromOpenBoard, OpenBoardParseError, parseOpenBoardSource } from '@/utils/open-board-import';

// Boards are sent as raw bytes rather than JSON so a 20 MB .obz is not inflated by a third
// through base64. nginx allows 100m on this host; the ceiling here is what the app accepts.
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export const POST = [
	authenticateRequest(),
	express.raw({ type: '*/*', limit: MAX_UPLOAD_BYTES }),
	async (req: Request, res: Response) => {
		const filename = typeof req.query.filename === 'string' ? req.query.filename : '';
		const lower = filename.toLowerCase();

		if (!lower.endsWith('.obf') && !lower.endsWith('.obz')) {
			return res.status(400).json({ error: 'Choose a .obf or .obz file.' });
		}

		const bytes = req.body as Buffer;
		if (!Buffer.isBuffer(bytes) || bytes.length === 0) {
			return res.status(400).json({ error: 'That file appears to be empty.' });
		}

		let imported: Awaited<ReturnType<typeof buildProjectFromOpenBoard>>;
		try {
			const parsed = await parseOpenBoardSource(filename, bytes);
			imported = await buildProjectFromOpenBoard(parsed, userImportAssetStore(req.userId as string), {
				fallbackName: filename.replace(/\.(obf|obz)$/i, ''),
			});
		} catch (err) {
			// Anything the parser recognised as bad input is worth showing the user verbatim;
			// everything else is ours and stays generic.
			if (err instanceof OpenBoardParseError) {
				return res.status(400).json({ error: err.message });
			}
			console.error('Open Board import failed:', err);
			return res.status(500).json({ error: 'That board could not be imported.' });
		}

		const blob = {
			name: imported.name,
			description: '',
			imageUrl: null,
			columns: imported.columns,
			rows: imported.rows,
			homePageId: imported.homePageId,
			pages: imported.pages,
		};

		const createdProject = await prisma.project.create({
			data: {
				name: imported.name,
				description: '',
				isPublic: false,
				columns: imported.columns,
				rows: imported.rows,
				userId: req.userId as string,
				homePageId: imported.homePageId,
				blob,
				lastEditedAt: new Date(),
			},
		});

		invalidateCache(`projects:${req.userId}`);

		return res.json({
			success: true,
			projectId: createdProject.id,
			pageCount: imported.pages.length,
			tileCount: imported.pages.reduce((n, p) => n + p.tiles.length, 0),
			imagesResolved: imported.imagesResolved,
			imagesTotal: imported.imagesTotal,
		});
	},
];
