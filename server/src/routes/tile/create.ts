/**
 * @deprecated This route is deprecated. Use /page/:id/tile/create instead.
 * Tiles are now stored as JSON in TilePage.tiles rather than a separate table.
 */
import type { Request, Response } from 'express';

export const POST = [
	async (_req: Request, res: Response) => {
		return res.status(410).json({
			error: 'This endpoint is deprecated. Use POST /page/:pageId/tile/create instead.',
			migration: 'Tiles are now identified by position (x, y, page) instead of ID.',
		});
	}
];
