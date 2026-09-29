import type { Request, Response } from 'express';
import { authenticateRequest } from '@/middleware/authenticate-request';
import prisma from '@/resources/prisma';
import { projectAccessWhere } from '@/utils/project-access';
import { buildProjectBlob } from '@/utils/project-blob';

export const GET = [
	authenticateRequest(),
	async (req: Request, res: Response) => {
		// Check access before returning even a 304. Unchanged boards do not read or transfer JSON.
		const metadata = await prisma.project.findFirst({
			where: projectAccessWhere(req.params.id, req.userId!),
			select: { lastEditedAt: true, updatedAt: true },
		});
		if (!metadata) return res.status(404).json({ error: 'Project not found' });
		const etag = `W/"${metadata.lastEditedAt.getTime()}-${metadata.updatedAt.getTime()}"`;
		res.set({ ETag: etag, 'Cache-Control': 'private, no-cache', Vary: 'Authorization' });
		if (req.get('If-None-Match') === etag) return res.status(304).end();
		const blob = await buildProjectBlob(req.params.id, req.userId!);

		if (!blob) {
			return res.status(404).json({ error: 'Project not found' });
		}

		return res.json({ blob });
	},
];
