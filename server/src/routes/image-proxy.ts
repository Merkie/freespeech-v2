import type { Request, Response } from 'express';
import { SafeFetchError, safeFetch } from '@/utils/safe-fetch';

export const GET = [
	async (req: Request, res: Response) => {
		const imageUrl = typeof req.query.url === 'string' ? req.query.url : '';
		if (!imageUrl) return res.status(400).json({ success: false, error: "Missing 'url' query parameter" });

		try {
			const response = await safeFetch(imageUrl, { headers: { 'User-Agent': 'FreeSpeech-ImageProxy/1.0' } });
			if (!response.ok) {
				return res.status(502).json({ success: false, error: `Failed to fetch image (${response.status})` });
			}
			if (!response.contentType.startsWith('image/')) {
				return res.status(400).json({ success: false, error: 'URL does not point to an image' });
			}

			res.setHeader('Content-Type', response.contentType);
			res.setHeader('Cache-Control', 'public, max-age=86400');
			res.setHeader('Access-Control-Allow-Origin', '*');
			res.setHeader('X-Content-Type-Options', 'nosniff');
			return res.send(response.body);
		} catch (error) {
			if (error instanceof SafeFetchError)
				return res.status(error.status).json({ success: false, error: error.message });
			throw error;
		}
	},
];
