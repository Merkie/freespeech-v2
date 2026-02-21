import { authenticateRequest } from '@/middleware/authenticate-request';
import { validateSchema } from '@/middleware/validate-schema';
import prisma from '@/resources/prisma';
import { invalidateCache } from '@/resources/cache';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { TileData, DEFAULT_TILE } from '@/utils/tile-types';

const schema = z.object({
	name: z.string(),
	columns: z.number(),
	rows: z.number()
});

export const POST = [
	authenticateRequest(),
	validateSchema(schema),
	async (req: Request, res: Response) => {
		const body = req.body as z.infer<typeof schema>;

		// Create the project first
		const createdProject = await prisma.project.create({
			data: {
				name: body.name,
				description: '',
				isPublic: false,
				columns: body.columns,
				rows: body.rows,
				userId: req.userId!
			}
		});

		// Create initial tile at position (0, 0)
		const initialTile: TileData = {
			x: 0,
			y: 0,
			page: 0,
			...DEFAULT_TILE,
		};

		// Create the home page with JSON tiles
		const createdHomePage = await prisma.tilePage.create({
			data: {
				name: 'Home',
				userId: req.userId!,
				connectedProjects: {
					create: {
						projectId: createdProject.id
					}
				},
				tiles: [initialTile]
			}
		});

		// Set the homePageId on the project
		await prisma.project.update({
			where: { id: createdProject.id },
			data: { homePageId: createdHomePage.id }
		});

		invalidateCache(`projects:${req.userId}`);

		return res.json({ success: true, projectId: createdProject.id });
	}
];
