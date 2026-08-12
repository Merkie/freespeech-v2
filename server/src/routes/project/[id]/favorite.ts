import type { Request, Response } from 'express';
import { authenticateRequest } from '@/middleware/authenticate-request';
import prisma from '@/resources/prisma';
import { getProjectAccess } from '@/utils/project-access';

export const POST = [
	authenticateRequest(),
	async (req: Request, res: Response) => {
		const project = await getProjectAccess(req.params.id, req.userId!);

		if (!project) {
			return res.status(404).json({ error: 'Project not found' });
		}

		if (project.role === 'collaborator') {
			const collaboration = project.collaborators[0];
			if (!collaboration) return res.status(404).json({ error: 'Project not found' });

			const updated = await prisma.projectCollaborator.update({
				where: { id: collaboration.id },
				data: { isFavorite: !collaboration.isFavorite },
				select: { isFavorite: true },
			});
			return res.json(updated);
		}

		const owned = await prisma.project.findUnique({
			where: { id: req.params.id },
			select: { isFavorite: true },
		});
		if (!owned) return res.status(404).json({ error: 'Project not found' });

		const updated = await prisma.project.update({
			where: { id: req.params.id },
			data: { isFavorite: !owned.isFavorite },
			select: { isFavorite: true },
		});

		return res.json({ isFavorite: updated.isFavorite });
	},
];
