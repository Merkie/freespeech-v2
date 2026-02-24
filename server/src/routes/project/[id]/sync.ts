import type { Request, Response } from 'express';
import { authenticateRequest } from '@/middleware/authenticate-request';
import { ProjectBlobSchema, applyProjectBlob } from '@/utils/project-blob';

export const POST = [
	authenticateRequest(),
	async (req: Request, res: Response) => {
		const { blob, lastEditedAt, force } = req.body;

		if (!blob || !lastEditedAt) {
			return res.status(400).json({ error: 'Missing blob or lastEditedAt' });
		}

		// Validate blob structure
		const parsed = ProjectBlobSchema.safeParse(blob);
		if (!parsed.success) {
			return res.status(400).json({ error: 'Invalid blob format', details: parsed.error.issues });
		}

		// Verify the blob ID matches the route param
		if (parsed.data.id !== req.params.id) {
			return res.status(400).json({ error: 'Blob ID does not match route' });
		}

		const result = await applyProjectBlob(req.params.id, req.userId!, parsed.data, lastEditedAt, !!force);

		if (!result.success) {
			if (result.conflict) {
				return res.status(409).json({
					error: 'Conflict — server has newer data',
					serverBlob: result.serverBlob,
				});
			}
			return res.status(404).json({ error: 'Project not found' });
		}

		return res.json({ success: true, lastEditedAt: result.newLastEditedAt });
	},
];
