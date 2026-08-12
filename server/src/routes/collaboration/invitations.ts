import type { Request, Response } from 'express';
import { z } from 'zod';
import { authenticateRequest } from '@/middleware/authenticate-request';
import prisma from '@/resources/prisma';

const responseSchema = z.object({
	invitationId: z.string().min(1),
	action: z.enum(['accept', 'decline']),
});

export const GET = [
	authenticateRequest(),
	async (req: Request, res: Response) => {
		const records = await prisma.projectCollaborator.findMany({
			where: {
				userId: req.userId,
				status: 'PENDING',
				project: { user: { collaborationEnabled: true } },
			},
			orderBy: { invitedAt: 'desc' },
			select: {
				id: true,
				invitedAt: true,
				project: {
					select: {
						id: true,
						name: true,
						description: true,
						imageUrl: true,
						user: { select: { name: true, profileImgUrl: true } },
					},
				},
			},
		});

		return res.json({
			invitations: records.map(({ project, ...record }) => ({
				...record,
				project: {
					id: project.id,
					name: project.name,
					description: project.description,
					imageUrl: project.imageUrl,
				},
				owner: project.user,
			})),
		});
	},
];

export const POST = [
	authenticateRequest(),
	async (req: Request, res: Response) => {
		const parsed = responseSchema.safeParse(req.body);
		if (!parsed.success) return res.status(400).json({ error: 'Invalid invitation response.' });

		const invitation = await prisma.projectCollaborator.findFirst({
			where: {
				id: parsed.data.invitationId,
				userId: req.userId,
				status: 'PENDING',
			},
			select: {
				id: true,
				project: { select: { user: { select: { collaborationEnabled: true } } } },
			},
		});
		if (!invitation) return res.status(404).json({ error: 'Invitation not found.' });

		if (parsed.data.action === 'decline') {
			await prisma.projectCollaborator.delete({ where: { id: invitation.id } });
			return res.json({ success: true });
		}

		if (!invitation.project.user.collaborationEnabled) {
			return res.status(409).json({ error: 'The board owner has paused collaboration.' });
		}

		await prisma.projectCollaborator.update({
			where: { id: invitation.id },
			data: { status: 'ACCEPTED', respondedAt: new Date() },
		});
		return res.json({ success: true });
	},
];
