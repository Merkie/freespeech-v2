import type { Request, Response } from 'express';
import { z } from 'zod';
import { authenticateRequest } from '@/middleware/authenticate-request';
import { validateSchema } from '@/middleware/validate-schema';
import { invalidateCache } from '@/resources/cache';
import prisma from '@/resources/prisma';

const schema = z.object({
	name: z.string().optional(),
});

export const POST = [
	authenticateRequest(),
	validateSchema(schema),
	async (req: Request, res: Response) => {
		const body = req.body as z.infer<typeof schema>;

		await prisma.tilePage.update({
			where: {
				id: req.params.id as string,
				userId: req.userId,
			},
			data: body,
		});

		invalidateCache(`page:${req.params.id}:${req.userId}`);
		invalidateCache(`project:${req.params.id}:${req.userId}`);

		return res.json({ success: true });
	},
];
