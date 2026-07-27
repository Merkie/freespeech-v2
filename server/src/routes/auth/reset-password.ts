import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { validateSchema } from '@/middleware/validate-schema';
import prisma from '@/resources/prisma';
import { readUnverifiedUserId, verifyPasswordResetToken } from '@/utils/token';

const schema = z.object({
	token: z.string().min(1),
	password: z.string().min(8),
});

// One message for every failure mode, so a bad token cannot be probed for detail.
const INVALID = 'This reset link is invalid or has expired.';

export const POST = [
	validateSchema(schema),
	async (req: Request, res: Response) => {
		const body = req.body as z.infer<typeof schema>;

		// Decode (without trusting) only to find which user's password hash to verify against.
		const userId = readUnverifiedUserId(body.token);
		if (!userId) return res.status(400).json({ error: INVALID });

		const user = await prisma.user.findUnique({ where: { id: userId } });
		if (!user?.password) return res.status(400).json({ error: INVALID });

		const verifiedId = verifyPasswordResetToken(body.token, user.password);
		if (!verifiedId || verifiedId !== user.id) return res.status(400).json({ error: INVALID });

		const hashedPassword = bcrypt.hashSync(body.password, 10);
		await prisma.user.update({
			where: { id: user.id },
			data: { password: hashedPassword },
		});

		return res.json({ success: true });
	},
];
