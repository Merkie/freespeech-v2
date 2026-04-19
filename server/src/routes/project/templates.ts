import type { Request, Response } from 'express';
import { authenticateRequest } from '@/middleware/authenticate-request';
import { TEMPLATES, templateBlobUrl, templateThumbnailUrl } from '@/data/templates';

export const GET = [
	authenticateRequest(),
	async (_req: Request, res: Response) => {
		const templates = TEMPLATES.map((t) => {
			const thumbExt = t.sourceThumbnailUrl.toLowerCase().endsWith('.svg') ? 'svg' : 'webp';
			return {
				slug: t.slug,
				name: t.name,
				description: t.description,
				creatorName: t.creatorName,
				thumbnailUrl: templateThumbnailUrl(t.slug, thumbExt),
				blobUrl: templateBlobUrl(t.slug),
			};
		});
		return res.json({ templates });
	},
];
