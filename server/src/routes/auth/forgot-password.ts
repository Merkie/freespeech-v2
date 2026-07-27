import type { Request, Response } from 'express';
import { z } from 'zod';
import { validateSchema } from '@/middleware/validate-schema';
import { sendPasswordResetEmail } from '@/resources/email';
import prisma from '@/resources/prisma';
import { CLIENT_HOST } from '@/utils/env';
import { generatePasswordResetToken } from '@/utils/token';

const schema = z.object({
	email: z.string().email(),
});

export const POST = [
	validateSchema(schema),
	async (req: Request, res: Response) => {
		const body = req.body as z.infer<typeof schema>;

		const user = await prisma.user.findFirst({
			where: {
				email: {
					equals: body.email,
					mode: 'insensitive',
				},
			},
		});

		// Only send when the account exists AND has a password. Google-only accounts have no
		// password to reset, so a link would just fail at the end of the flow.
		if (user?.password) {
			const token = generatePasswordResetToken(user.id, user.password);
			const resetUrl = `${CLIENT_HOST}/login/reset-password?token=${encodeURIComponent(token)}`;
			try {
				await sendPasswordResetEmail(user.email, resetUrl);
			} catch (e) {
				console.error('Failed to send password reset email:', e);
			}
		}

		// Always answer identically so the endpoint cannot be used to discover which addresses
		// have accounts.
		return res.json({ success: true });
	},
];
