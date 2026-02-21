/**
 * @deprecated This route is deprecated. Use /page/:pageId/tile/update instead.
 * Tiles are now identified by position (x, y, page) instead of CUID.
 */
import type { Request, Response } from 'express';

export const POST = [
	async (_req: Request, res: Response) => {
		return res.status(410).json({
			error: 'This endpoint is deprecated. Use POST /page/:pageId/tile/update instead.',
			migration: 'Tiles are now identified by position (x, y, page) instead of ID.',
		});
	},
];
