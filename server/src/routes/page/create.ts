import { z } from 'zod';
import type { Request, Response } from 'express';
import { authenticateRequest } from '@/middleware/authenticate-request';
import { validateSchema } from '@/middleware/validate-schema';
import prisma from '@/resources/prisma';
import slugify from '@/utils/slugify';
import { invalidateCache } from '@/resources/cache';
import { TileData, DEFAULT_TILE } from '@/utils/tile-types';
import { updateProjectLastEditedAt } from '@/utils/update-project-last-edited';

const schema = z.object({
	name: z.string().min(1).max(50),
	projectId: z.string()
});

export const POST = [
	authenticateRequest(),
	validateSchema(schema),
	async (req: Request, res: Response) => {
		const body = req.body as z.infer<typeof schema>;

		// Get the project
		const project = await prisma.project.findUnique({
			where: {
				id: body.projectId,
				userId: req.userId
			},
			include: {
				connectedPages: {
					include: {
						tilePage: true
					}
				}
			}
		});

		// Check if the project exists
		if (!project) return res.json({ error: 'The project you are trying to edit does not exist.' });

		// Check if the page already exists
		if (
			project.connectedPages
				.map(({ tilePage }) => slugify(tilePage.name))
				.includes(slugify(body.name))
		)
			return res.json({
				error: 'A page with that name already exists in the project.'
			});

		// Create initial tile at position (0, 0)
		const initialTile: TileData = {
			x: 0,
			y: 0,
			page: 0,
			...DEFAULT_TILE,
		};

		// Create the page with JSON tiles
		const page = await prisma.tilePage.create({
			data: {
				name: body.name,
				user: {
					connect: {
						id: req.userId
					}
				},
				connectedProjects: {
					create: {
						projectId: project.id
					}
				},
				tiles: [initialTile]
			}
		});

		// Update project lastEditedAt
		await updateProjectLastEditedAt(page.id);

		invalidateCache(`project:${body.projectId}:${req.userId}`);

		return res.json({ page });
	}
];
