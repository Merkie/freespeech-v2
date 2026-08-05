import type { Request, Response } from 'express';
import { authenticateRequest } from '@/middleware/authenticate-request';
import prisma from '@/resources/prisma';

export const GET = [
	authenticateRequest(),
	async (req: Request, res: Response) => {
		const user = await prisma.user.findUnique({
			where: {
				id: req.userId,
			},
		});
		if (!user) return res.status(404).json({ error: 'User not found' });

		// Access-control verifiers have their own authenticated endpoint. Keeping them out of the
		// general profile response makes it harder to accidentally persist them in unrelated caches.
		const {
			editPinEnabled: _editPinEnabled,
			editPinMode: _editPinMode,
			editPinHash: _editPinHash,
			editPinSalt: _editPinSalt,
			editPinUpdatedAt: _editPinUpdatedAt,
			...safeUser
		} = user;
		if (safeUser.password) safeUser.password = 'redacted';

		res.json({ user: safeUser });
	},
];
