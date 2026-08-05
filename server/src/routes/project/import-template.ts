import { GetObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { authenticateRequest } from '@/middleware/authenticate-request';
import { validateSchema } from '@/middleware/validate-schema';
import { TEMPLATES, templateBlobKey } from '@/data/templates';
import prisma from '@/resources/prisma';
import s3 from '@/resources/s3';
import { R2_BUCKET } from '@/utils/env';
import { ProjectBlobSchema, type PageBlob, type ProjectBlob } from '@/utils/project-blob';

const schema = z.object({
	slug: z.string().min(1),
});

export const POST = [
	authenticateRequest(),
	validateSchema(schema),
	async (req: Request, res: Response) => {
		const { slug } = req.body as z.infer<typeof schema>;

		const template = TEMPLATES.find((t) => t.slug === slug);
		if (!template) {
			return res.status(404).json({ error: 'Template not found' });
		}

		let blob: ProjectBlob;
		try {
			blob = await loadTemplateBlob(slug);
		} catch (err) {
			console.error(`Failed to load template blob for ${slug}:`, err);
			return res.status(500).json({ error: 'Failed to load template' });
		}

		const { pages, homePageId } = rekeyPages(blob.pages, blob.homePageId);

		const now = new Date();
		const newBlob = {
			name: template.name,
			description: template.description,
			imageUrl: blob.imageUrl,
			columns: blob.columns,
			rows: blob.rows,
			homePageId,
			pages,
		};

		const createdProject = await prisma.project.create({
			data: {
				name: template.name,
				description: template.description,
				isPublic: false,
				columns: blob.columns,
				rows: blob.rows,
				userId: req.userId!,
				homePageId,
				imageUrl: blob.imageUrl,
				blob: newBlob,
				lastEditedAt: now,
			},
		});

		return res.json({ success: true, projectId: createdProject.id });
	},
];

async function loadTemplateBlob(slug: string): Promise<ProjectBlob> {
	const resp = await s3.send(
		new GetObjectCommand({ Bucket: R2_BUCKET, Key: templateBlobKey(slug) }),
	);
	if (!resp.Body) throw new Error('Template blob body empty');
	const chunks: Buffer[] = [];
	for await (const chunk of resp.Body as AsyncIterable<Uint8Array>) {
		chunks.push(Buffer.from(chunk));
	}
	const raw = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
	raw.id = '';
	raw.lastEditedAt = new Date(0).toISOString();
	return ProjectBlobSchema.parse(raw);
}

function rekeyPages(
	pages: PageBlob[],
	oldHomePageId: string | null,
): { pages: PageBlob[]; homePageId: string | null } {
	const idMap = new Map<string, string>();
	for (const page of pages) {
		idMap.set(page.id, crypto.randomUUID());
	}

	const rekeyed: PageBlob[] = pages.map((page) => ({
		...page,
		id: idMap.get(page.id)!,
		tiles: page.tiles.map((tile) => {
			if (tile.navigation && idMap.has(tile.navigation)) {
				return { ...tile, navigation: idMap.get(tile.navigation)! };
			}
			return tile;
		}),
	}));

	const homePageId = oldHomePageId && idMap.has(oldHomePageId) ? idMap.get(oldHomePageId)! : null;
	return { pages: rekeyed, homePageId };
}
