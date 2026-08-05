import type { Request, Response } from 'express';
import { z } from 'zod';
import { authenticateRequest } from '@/middleware/authenticate-request';
import { validateSchema } from '@/middleware/validate-schema';
import prisma from '@/resources/prisma';

const PIN_HASH_PATTERN = /^[0-9a-f]{64}$/;
const PIN_SALT_PATTERN = /^[0-9a-f]{32}$/;

const updateSchema = z
	.object({
		enabled: z.boolean(),
		mode: z.enum(['pin', 'math']),
		pinHash: z.string().regex(PIN_HASH_PATTERN).nullable(),
		pinSalt: z.string().regex(PIN_SALT_PATTERN).nullable(),
	})
	.superRefine((settings, context) => {
		if (settings.enabled && settings.mode === 'pin' && (!settings.pinHash || !settings.pinSalt)) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'An enabled PIN requires a valid hash and salt.',
			});
		}
	});

function serialize(settings: {
	editPinEnabled: boolean;
	editPinMode: string;
	editPinHash: string | null;
	editPinSalt: string | null;
	editPinUpdatedAt: Date;
}) {
	return {
		enabled: settings.editPinEnabled,
		mode: settings.editPinMode === 'math' ? ('math' as const) : ('pin' as const),
		pinHash: settings.editPinHash,
		pinSalt: settings.editPinSalt,
		updatedAt: settings.editPinUpdatedAt.toISOString(),
	};
}

const select = {
	editPinEnabled: true,
	editPinMode: true,
	editPinHash: true,
	editPinSalt: true,
	editPinUpdatedAt: true,
} as const;

export const GET = [
	authenticateRequest(),
	async (req: Request, res: Response) => {
		const user = await prisma.user.findUnique({ where: { id: req.userId }, select });
		if (!user) return res.status(404).json({ error: 'User not found' });

		return res.json({ settings: serialize(user) });
	},
];

export const POST = [
	authenticateRequest(),
	validateSchema(updateSchema),
	async (req: Request, res: Response) => {
		const body = req.body as z.infer<typeof updateSchema>;
		const usesPin = body.enabled && body.mode === 'pin';

		const user = await prisma.user.update({
			where: { id: req.userId },
			data: {
				editPinEnabled: body.enabled,
				editPinMode: body.enabled ? body.mode : 'pin',
				editPinHash: usesPin ? body.pinHash : null,
				editPinSalt: usesPin ? body.pinSalt : null,
				editPinUpdatedAt: new Date(),
			},
			select,
		});

		return res.json({ settings: serialize(user) });
	},
];
