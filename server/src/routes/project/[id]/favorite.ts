import type { Request, Response } from 'express';
import { authenticateRequest } from '@/middleware/authenticate-request';
import prisma from '@/resources/prisma';

export const POST = [
	authenticateRequest(),
	async (req: Request, res: Response) => {
		const project = await prisma.project.findFirst({
			where: { id: req.params.id, userId: req.userId },
			select: { isFavorite: true },
		});

		if (!project) {
			return res.status(404).json({ error: 'Project not found' });
		}

		const updated = await prisma.project.update({
			where: { id: req.params.id },
			data: { isFavorite: !project.isFavorite },
			select: { isFavorite: true },
		});

		return res.json({ isFavorite: updated.isFavorite });
	},
];
