import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { authenticateRequest } from '@/middleware/authenticate-request';
import { validateSchema } from '@/middleware/validate-schema';
import prisma from '@/resources/prisma';
import { deleteAccount, deleteUnreferencedMedia } from '@/utils/account-data';
import { authLimits, tooManyAttempts } from '@/utils/rate-limit';

const schema = z.object({
	password: z.string().max(1024).optional(),
	email: z.string().max(320).optional(),
});

export const POST = [
	authenticateRequest(),
	validateSchema(schema),
	async (req: Request, res: Response) => {
		const body = req.body as z.infer<typeof schema>;
		const userId = req.userId!;
		const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, password: true } });
		if (!user) return res.status(404).json({ error: 'User not found' });

		// Password accounts confirm with the password; Google-only accounts type their email.
		const failures = authLimits.deleteFailuresPerUser;
		const wait = failures.consume(userId);
		if (wait) return tooManyAttempts(res, wait);
		const confirmed = user.password
			? !!body.password && (await bcrypt.compare(body.password, user.password))
			: body.email?.trim().toLowerCase() === user.email.toLowerCase();
		if (!confirmed) {
			return res.status(403).json({
				error: user.password ? 'That password is not correct.' : 'That email does not match this account.',
			});
		}
		failures.reset(userId);

		const result = await deleteAccount(userId);
		if (!result) return res.status(404).json({ error: 'User not found' });

		let media = { deleted: 0, kept: 0 };
		try {
			media = await deleteUnreferencedMedia(result.mediaKeys);
		} catch (error) {
			console.warn('[account-deletion] Media cleanup failed:', error);
		}
		console.log(
			`[account-deletion] Deleted account ${userId}; media deleted ${media.deleted}, kept ${media.kept}` +
				(result.importedFromV1 ? ' (imported account: media shared with the original app was kept)' : ''),
		);
		return res.json({ success: true });
	},
];
