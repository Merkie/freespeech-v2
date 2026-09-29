import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { validateSchema } from '@/middleware/validate-schema';
import prisma from '@/resources/prisma';
import { authLimits, emailKey, limitByIp, tooManyAttempts } from '@/utils/rate-limit';
import { generateToken } from '@/utils/token';

const schema = z.object({
	email: z.string().email(),
	password: z.string(),
});

export const POST = [
	limitByIp(authLimits.loginPerIp),
	validateSchema(schema),
	async (req: Request, res: Response) => {
		const body = req.body as z.infer<typeof schema>;
		const failures = authLimits.loginFailuresPerEmail;
		const key = emailKey(body.email);
		// Counted before the password check so parallel guesses cannot all slip under the limit;
		// a successful sign-in clears the count.
		const wait = failures.consume(key);
		if (wait) return tooManyAttempts(res, wait);
		const reject = () => res.status(401).json({ error: 'Invalid email or password' });

		const user = await prisma.user.findFirst({
			where: {
				email: {
					equals: body.email,
					mode: 'insensitive',
				},
			},
		});
		if (!user?.password) return reject();

		const doPasswordsMatch = await bcrypt.compare(body.password, user.password);
		if (!doPasswordsMatch) return reject();
		failures.reset(key);

		const { token } = generateToken(user.id);

		return res.json({ token });
	},
];
