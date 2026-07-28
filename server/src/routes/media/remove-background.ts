import { PutObjectCommand } from '@aws-sdk/client-s3';
import { fal } from '@fal-ai/client';
import { createId } from '@paralleldrive/cuid2';
import type { Request, Response } from 'express';
import sharp from 'sharp';
import { z } from 'zod';
import { authenticateRequest } from '@/middleware/authenticate-request';
import { validateSchema } from '@/middleware/validate-schema';
import s3 from '@/resources/s3';
import { R2_BUCKET } from '@/utils/env';

const schema = z.object({
	image_url: z.string().url(),
});

// A drained or locked fal account leaves jobs IN_QUEUE forever, so cap the wait
// both server-side (startTimeout) and locally rather than hanging the request.
const REMOVAL_TIMEOUT_MS = 90_000;

export const POST = [
	authenticateRequest(),
	validateSchema(schema),
	async (req: Request, res: Response) => {
		const body = req.body as z.infer<typeof schema>;

		let timer: ReturnType<typeof setTimeout> | undefined;
		let result: { data: { image: { url: string } | null } };
		try {
			result = (await Promise.race([
				fal.subscribe('pixelcut/background-removal', {
					input: {
						image_url: body.image_url,
						output_format: 'rgba',
						// A hosted URL rather than a data: URL, so the fetch below works unchanged.
						sync_mode: false,
					},
					startTimeout: 60,
				}),
				new Promise<never>((_, reject) => {
					timer = setTimeout(() => reject(new Error('Background removal timed out')), REMOVAL_TIMEOUT_MS);
				}),
			])) as typeof result;
		} finally {
			clearTimeout(timer);
		}

		const image = result.data.image;
		if (!image?.url) throw new Error('Background removal returned no image');

		// Fetch the image and trim transparent pixels
		const imageResponse = await fetch(image.url);
		const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

		const trimmedImage = await sharp(imageBuffer).trim().png().toBuffer();

		// Upload trimmed image to R2
		const key = `${createId()}.png`;
		await s3.send(
			new PutObjectCommand({
				Bucket: R2_BUCKET,
				Key: key,
				Body: trimmedImage,
				ContentType: 'image/png',
			}),
		);

		res.json({
			image_url: `https://media.freespeechaac.com/${key}`,
		});
	},
];
