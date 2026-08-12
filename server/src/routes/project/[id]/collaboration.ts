import type { Request, Response } from 'express';
import { authenticateRequest } from '@/middleware/authenticate-request';
import prisma from '@/resources/prisma';

export const DELETE = [
	authenticateRequest(),
	async (req: Request, res: Response) => {
		const result = await prisma.projectCollaborator.deleteMany({
			where: {
				projectId: req.params.id,
				userId: req.userId,
				status: 'ACCEPTED',
			},
		});

		if (result.count === 0) return res.status(404).json({ error: 'Shared board not found.' });
		return res.json({ success: true });
	},
];
