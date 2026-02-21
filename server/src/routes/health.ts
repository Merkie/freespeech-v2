import type { Request, Response } from 'express';

export const get = [
	async (_req: Request, res: Response): Promise<void> => {
		res.json({ status: 'ok' });
	},
];
