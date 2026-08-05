import crypto from 'crypto';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { authenticateRequest } from '@/middleware/authenticate-request';
import { validateSchema } from '@/middleware/validate-schema';
import prisma from '@/resources/prisma';

const schema = z.object({
	name: z.string(),
	columns: z.number(),
	rows: z.number(),
});

export const POST = [
	authenticateRequest(),
	validateSchema(schema),
	async (req: Request, res: Response) => {
		const body = req.body as z.infer<typeof schema>;

		const homePageId = crypto.randomUUID();

		const initialTile = {
			x: 0,
			y: 0,
			page: 0,
			text: 'New tile',
		};

		const blob = {
			name: body.name,
			description: '',
			imageUrl: null,
			columns: body.columns,
			rows: body.rows,
			homePageId,
			pages: [
				{
					id: homePageId,
					name: 'Home',
					tiles: [initialTile],
				},
			],
		};

		const createdProject = await prisma.project.create({
			data: {
				name: body.name,
				description: '',
				isPublic: false,
				columns: body.columns,
				rows: body.rows,
				userId: req.userId!,
				homePageId,
				blob,
			},
		});

		return res.json({ success: true, projectId: createdProject.id });
	},
];
