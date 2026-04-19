import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import type { Request, Response } from 'express';
import { authenticateRequest } from '@/middleware/authenticate-request';
import { invalidateCache } from '@/resources/cache';
import prisma from '@/resources/prisma';
import s3 from '@/resources/s3';
import { R2_BUCKET } from '@/utils/env';

export const POST = [
	authenticateRequest(),
	async (req: Request, res: Response) => {
		const projectId = req.params.id;

		const project = await prisma.project.findFirst({
			where: { id: projectId, userId: req.userId },
		});

		if (!project) {
			return res.status(404).json({ error: 'Project not found' });
		}

		// Best-effort thumbnail cleanup — skip shared template thumbnails.
		if (project.imageUrl && !project.imageUrl.startsWith('/template-')) {
			const key = project.imageUrl.split('/').filter(Boolean).join('/');
			try {
				await s3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
			} catch (err) {
				console.warn(`Failed to delete thumbnail ${key}:`, err);
			}
		}

		await prisma.project.delete({ where: { id: projectId } });
		invalidateCache(`projects:${req.userId}`);

		return res.json({ success: true });
	},
];
