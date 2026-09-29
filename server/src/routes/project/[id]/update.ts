import type { Request, Response } from 'express';
import { z } from 'zod';
import { authenticateRequest } from '@/middleware/authenticate-request';
import { validateSchema } from '@/middleware/validate-schema';
import { nextProjectVersion, withLockedProject } from '@/utils/locked-project';
import type { PageBlob } from '@/utils/project-blob';

// The same sanity bound as ProjectBlobSchema; the client offers up to 12 unless a board is larger.
const dimension = z.number().int().min(1).max(30);
const schema = z
	.object({
		name: z.string().trim().min(1).max(100).optional(),
		columns: dimension.optional(),
		rows: dimension.optional(),
	})
	.refine((body) => body.name !== undefined || body.columns !== undefined || body.rows !== undefined);

/** Owner-only board settings. Writes the blob under the row lock so it behaves like any other save. */
export const POST = [
	authenticateRequest(),
	validateSchema(schema),
	async (req: Request, res: Response) => {
		const body = req.body as z.infer<typeof schema>;
		const projectId = req.params.id;

		const result = await withLockedProject(projectId, async (tx) => {
			const project = await tx.project.findFirst({ where: { id: projectId, userId: req.userId } });
			if (!project) return { status: 404, error: 'Project not found' } as const;

			const blob = project.blob as { name?: string; columns?: number; rows?: number; pages?: PageBlob[] };
			const columns = body.columns ?? project.columns;
			const rows = body.rows ?? project.rows;
			// Tiles are placed by grid position; a smaller grid would push them out of view.
			const outside = (blob.pages ?? [])
				.flatMap((page) => page.tiles)
				.filter((tile) => tile.x >= columns || tile.y >= rows).length;
			if (outside > 0) {
				return {
					status: 409,
					error: `${outside} tile${outside === 1 ? ' is' : 's are'} outside a ${columns} × ${rows} grid. Move or delete ${outside === 1 ? 'it' : 'them'} first.`,
				} as const;
			}

			const name = body.name ?? project.name;
			const lastEditedAt = nextProjectVersion(project.lastEditedAt);
			await tx.project.update({
				where: { id: projectId },
				data: { name, columns, rows, blob: { ...blob, name, columns, rows }, lastEditedAt },
			});
			return {
				status: 200,
				project: { id: projectId, name, columns, rows, lastEditedAt: lastEditedAt.toISOString() },
			} as const;
		});

		if (result.status !== 200) return res.status(result.status).json({ error: result.error });
		return res.json({ success: true, project: result.project });
	},
];
