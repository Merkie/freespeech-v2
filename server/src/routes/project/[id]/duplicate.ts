import type { Request, Response } from 'express';
import { authenticateRequest } from '@/middleware/authenticate-request';
import prisma from '@/resources/prisma';
import { projectAccessWhere } from '@/utils/project-access';

export const POST = [
	authenticateRequest(),
	async (req: Request, res: Response) => {
		const source = await prisma.project.findFirst({
			where: projectAccessWhere(req.params.id, req.userId!),
			select: {
				name: true,
				description: true,
				columns: true,
				rows: true,
				homePageId: true,
				blob: true,
			},
		});
		if (!source) return res.status(404).json({ error: 'Project not found' });

		const name = `${source.name} Copy`;
		const blob = structuredClone(source.blob) as Record<string, unknown>;
		delete blob.id;
		delete blob.lastEditedAt;
		blob.name = name;
		blob.imageUrl = null;

		const duplicate = await prisma.project.create({
			data: {
				userId: req.userId!,
				name,
				description: source.description,
				imageUrl: null,
				columns: source.columns,
				rows: source.rows,
				isPublic: false,
				isFavorite: false,
				homePageId: source.homePageId,
				blob,
			},
			select: { id: true, name: true },
		});

		return res.json({ success: true, project: duplicate });
	},
];
