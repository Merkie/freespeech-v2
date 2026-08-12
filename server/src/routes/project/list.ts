import type { Request, Response } from 'express';
import { authenticateRequest } from '@/middleware/authenticate-request';
import prisma from '@/resources/prisma';

export const GET = [
	authenticateRequest(),
	async (req: Request, res: Response) => {
		// Summary fields only — the full blob is fetched per-project via /project/:id/blob.
		const records = await prisma.project.findMany({
			where: {
				OR: [
					{ userId: req.userId },
					{
						user: { collaborationEnabled: true },
						collaborators: { some: { userId: req.userId, status: 'ACCEPTED' } },
					},
				],
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
				user: {
					select: {
						name: true,
						profileImgUrl: true,
						collaborationEnabled: true,
					},
				},
				collaborators: {
					where: { userId: req.userId, status: 'ACCEPTED' },
					select: { isFavorite: true },
				},
				_count: {
					select: { collaborators: { where: { status: 'ACCEPTED' } } },
				},
			},
		});

		const projects = records.map(({ user, collaborators, _count, ...project }) => {
			const isOwner = project.userId === req.userId;
			return {
				...project,
				isFavorite: isOwner ? project.isFavorite : (collaborators[0]?.isFavorite ?? false),
				accessRole: isOwner ? ('owner' as const) : ('collaborator' as const),
				owner: {
					name: user.name,
					profileImgUrl: user.profileImgUrl,
				},
				collaborationEnabled: isOwner && user.collaborationEnabled,
				collaboratorCount: _count.collaborators,
			};
		});

		return res.json({ projects });
	},
];
