import type { Request, Response } from 'express';
import { z } from 'zod';
import { authenticateRequest } from '@/middleware/authenticate-request';
import { validateSchema } from '@/middleware/validate-schema';
import { SafeFetchError, safeFetch } from '@/utils/safe-fetch';

const schema = z.object({
	url: z.string().url(),
});

export const POST = [
	authenticateRequest(),
	validateSchema(schema),
	async (req: Request, res: Response) => {
		const body = req.body as z.infer<typeof schema>;

		let response: Awaited<ReturnType<typeof safeFetch>>;
		try {
			response = await safeFetch(body.url);
		} catch (error) {
			if (error instanceof SafeFetchError) return res.status(error.status).send(error.message);
			throw error;
		}
		if (!response.ok) return res.status(502).send('Failed to fetch the image');
		// Some image hosts label files as generic binary; anything else (HTML, JSON, text) is refused.
		if (!/^(image\/|application\/octet-stream|binary\/octet-stream)/i.test(response.contentType))
			return res.status(400).send('URL does not point to an image');

		const extension =
			response.contentType
				.split(';')[0]
				.split('/')
				.pop()
				?.replace(/[^a-z0-9+.-]/gi, '') || 'jpg';
		res.setHeader('Content-Type', response.contentType);
		res.setHeader('Content-Length', response.body.length.toString());
		res.setHeader('Content-Disposition', `attachment; filename="image.${extension}"`);
		res.setHeader('X-Content-Type-Options', 'nosniff');
		res.end(response.body);
	},
];
