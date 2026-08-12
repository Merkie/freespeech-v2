import type { Request, Response } from 'express';
import { z } from 'zod';
import { authenticateRequest } from '@/middleware/authenticate-request';
import { validateSchema } from '@/middleware/validate-schema';
import prisma from '@/resources/prisma';

const schema = z.object({ enabled: z.boolean() });

export const POST = [
	authenticateRequest(),
	validateSchema(schema),
	async (req: Request, res: Response) => {
		const body = req.body as z.infer<typeof schema>;
		const user = await prisma.user.update({
			where: { id: req.userId },
			data: { collaborationEnabled: body.enabled },
			select: { collaborationEnabled: true },
		});

		return res.json({ enabled: user.collaborationEnabled });
	},
];
