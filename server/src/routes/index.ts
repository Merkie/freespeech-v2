import type { NextFunction, Request, Response } from 'express';

export const get = [
	async (_req: Request, res: Response, _next: NextFunction): Promise<void> => {
		res.json({ message: 'Hello World' });
	},
];
