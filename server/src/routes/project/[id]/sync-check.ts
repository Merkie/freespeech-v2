import type { Request, Response } from 'express';
import { authenticateRequest } from '@/middleware/authenticate-request';
import prisma from '@/resources/prisma';

/**
 * Lightweight endpoint for cache invalidation checks.
 * Returns only the lastEditedAt timestamp for a project.
 * Clients can compare this with their cached version to determine if
 * a full refresh is needed.
 */
export const GET = [
	authenticateRequest(),
	async (req: Request, res: Response) => {
		const projectId = req.params.id;

		const project = await prisma.project.findFirst({
			where: {
				id: projectId,
				// Allow access if user owns the project or it's public
				OR: [{ userId: req.userId }, { isPublic: true }],
			},
			select: {
				id: true,
				lastEditedAt: true,
				updatedAt: true,
			},
		});

		if (!project) {
			return res.status(404).json({ error: 'Project not found.' });
		}

		return res.json({
			id: project.id,
			lastEditedAt: project.lastEditedAt.toISOString(),
			updatedAt: project.updatedAt.toISOString(),
		});
	},
];
