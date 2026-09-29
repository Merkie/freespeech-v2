import type { Request, Response } from 'express';
import { authenticateRequest } from '@/middleware/authenticate-request';
import { buildAccountExport } from '@/utils/account-data';

export const GET = [
	authenticateRequest(),
	async (req: Request, res: Response) => {
		const data = await buildAccountExport(req.userId!);
		if (!data) return res.status(404).json({ error: 'User not found' });

		const date = data.exportedAt.slice(0, 10);
		res.setHeader('Content-Disposition', `attachment; filename="freespeech-data-${date}.json"`);
		res.setHeader('Cache-Control', 'no-store');
		return res.json(data);
	},
];
