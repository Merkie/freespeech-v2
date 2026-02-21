import type { Request, Response } from 'express';
import { authenticateRequest } from '@/middleware/authenticate-request';
import prisma from '@/resources/prisma';

export const GET = [
	authenticateRequest(),
	async (req: Request, res: Response) => {
		// Tiles are now embedded as JSON in the tiles column, no include needed
		const template = await prisma.tilePage.findFirst({
			where: {
				id: req.params.id,
				userId: req.userId,
				isTemplate: true,
			},
			include: {
				connectedProjects: {
					include: {
						project: {
							select: {
								id: true,
								name: true,
								columns: true,
								rows: true,
							},
						},
					},
				},
				pagesUsingAsTemplate: {
					include: {
						tilePage: {
							select: {
								id: true,
								name: true,
							},
						},
					},
				},
			},
		});

		if (!template) {
			return res.status(404).json({ error: 'Template not found.' });
		}

		return res.json({
			template: {
				...template,
				project: template.connectedProjects[0]?.project || null,
				linkedPages: template.pagesUsingAsTemplate.map((link) => link.tilePage),
				_count: { linkedPages: template.pagesUsingAsTemplate.length },
			},
		});
	},
];
