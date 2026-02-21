import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { validateSchema } from '@/middleware/validate-schema';
import prisma from '@/resources/prisma';
import { generateToken } from '@/utils/token';

const schema = z.object({
	email: z.string().email(),
	password: z.string(),
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
		if (!user) return res.status(401).json({ error: 'Invalid email or password' });
		if (!user.password) return res.status(401).json({ error: 'Invalid email or password' });

		const doPasswordsMatch = bcrypt.compareSync(body.password, user.password);
		if (!doPasswordsMatch) return res.status(401).json({ error: 'Invalid email or password' });

		const { token } = generateToken(user.id);

		return res.json({ token });
	},
];
