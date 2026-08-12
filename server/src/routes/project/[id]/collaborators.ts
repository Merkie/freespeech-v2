import type { Request, Response } from 'express';
import { z } from 'zod';
import { authenticateRequest } from '@/middleware/authenticate-request';
import prisma from '@/resources/prisma';

const lookupSchema = z.object({
	action: z.literal('lookup'),
	email: z
		.string()
		.trim()
		.email()
		.transform((email) => email.toLowerCase()),
});

const inviteSchema = z.object({
	action: z.literal('invite'),
	userId: z.string().min(1),
});

const removeSchema = z.object({ userId: z.string().min(1) });

async function getManageableProject(projectId: string, userId: string) {
	return prisma.project.findFirst({
		where: { id: projectId, userId },
		select: {
			id: true,
			name: true,
			user: { select: { collaborationEnabled: true } },
		},
	});
}

export const GET = [
	authenticateRequest(),
	async (req: Request, res: Response) => {
		const project = await getManageableProject(req.params.id, req.userId!);
		if (!project) return res.status(404).json({ error: 'Project not found' });
		if (!project.user.collaborationEnabled) {
			return res.status(403).json({ error: 'Board collaboration is turned off in Access Controls.' });
		}

		const records = await prisma.projectCollaborator.findMany({
			where: { projectId: project.id },
			orderBy: { invitedAt: 'asc' },
			select: {
				id: true,
				status: true,
				invitedAt: true,
				respondedAt: true,
				user: {
					select: { id: true, name: true, email: true, profileImgUrl: true },
				},
			},
		});

		return res.json({
			project: { id: project.id, name: project.name },
			collaborators: records.map((record) => ({
				...record,
				status: record.status.toLowerCase(),
			})),
		});
	},
];

export const POST = [
	authenticateRequest(),
	async (req: Request, res: Response) => {
		const project = await getManageableProject(req.params.id, req.userId!);
		if (!project) return res.status(404).json({ error: 'Project not found' });
		if (!project.user.collaborationEnabled) {
			return res.status(403).json({ error: 'Board collaboration is turned off in Access Controls.' });
		}

		const lookup = lookupSchema.safeParse(req.body);
		if (lookup.success) {
			const candidate = await prisma.user.findFirst({
				where: { email: { equals: lookup.data.email, mode: 'insensitive' } },
				select: { id: true, name: true, email: true, profileImgUrl: true },
			});

			if (!candidate || candidate.id === req.userId) {
				return res.status(404).json({ error: 'No other FreeSpeech account matches that email.' });
			}

			const existing = await prisma.projectCollaborator.findUnique({
				where: { projectId_userId: { projectId: project.id, userId: candidate.id } },
				select: { status: true },
			});

			return res.json({
				candidate,
				status: existing?.status.toLowerCase() ?? null,
			});
		}

		const invite = inviteSchema.safeParse(req.body);
		if (!invite.success || invite.data.userId === req.userId) {
			return res.status(400).json({ error: 'Invalid collaborator request.' });
		}

		const candidate = await prisma.user.findUnique({
			where: { id: invite.data.userId },
			select: { id: true },
		});
		if (!candidate) return res.status(404).json({ error: 'Account not found.' });

		const existing = await prisma.projectCollaborator.findUnique({
			where: { projectId_userId: { projectId: project.id, userId: candidate.id } },
			select: { status: true },
		});
		if (existing?.status === 'ACCEPTED') {
			return res.status(409).json({ error: 'This person already collaborates on the board.' });
		}

		await prisma.projectCollaborator.upsert({
			where: { projectId_userId: { projectId: project.id, userId: candidate.id } },
			create: { projectId: project.id, userId: candidate.id },
			update: { status: 'PENDING', invitedAt: new Date(), respondedAt: null },
		});

		return res.json({ success: true });
	},
];

export const DELETE = [
	authenticateRequest(),
	async (req: Request, res: Response) => {
		const parsed = removeSchema.safeParse(req.body);
		if (!parsed.success) return res.status(400).json({ error: 'Invalid collaborator request.' });

		const project = await prisma.project.findFirst({
			where: { id: req.params.id, userId: req.userId },
			select: { id: true },
		});
		if (!project) return res.status(404).json({ error: 'Project not found' });

		await prisma.projectCollaborator.deleteMany({
			where: { projectId: project.id, userId: parsed.data.userId },
		});
		return res.json({ success: true });
	},
];
