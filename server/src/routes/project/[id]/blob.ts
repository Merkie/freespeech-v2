import type { Request, Response } from 'express';
import { authenticateRequest } from '@/middleware/authenticate-request';
import { buildProjectBlob } from '@/utils/project-blob';

export const GET = [
	authenticateRequest(),
	async (req: Request, res: Response) => {
		const blob = await buildProjectBlob(req.params.id, req.userId!);

		if (!blob) {
			return res.status(404).json({ error: 'Project not found' });
		}

		return res.json({ blob });
	},
];
