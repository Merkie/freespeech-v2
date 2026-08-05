import type { Request, Response } from 'express';
import { authenticateRequest } from '@/middleware/authenticate-request';
import prisma from '@/resources/prisma';

export const GET = [
	authenticateRequest(),
	async (req: Request, res: Response) => {
		// Summary fields only — the full blob is fetched per-project via /project/:id/blob.
		const projects = await prisma.project.findMany({
			where: {
				userId: req.userId,
			},
			orderBy: {
				updatedAt: 'desc',
			},
			select: {
				id: true,
				userId: true,
				name: true,
				description: true,
				imageUrl: true,
				columns: true,
				rows: true,
				isPublic: true,
				isFavorite: true,
				homePageId: true,
				lastEditedAt: true,
				createdAt: true,
				updatedAt: true,
			},
		});

		return res.json({ projects });
	},
];
