import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import type { Request, Response } from 'express';
import puppeteer, { type Browser } from 'puppeteer';
import { authenticateRequest } from '@/middleware/authenticate-request';
import prisma from '@/resources/prisma';
import s3 from '@/resources/s3';
import { CLIENT_HOST, R2_BUCKET } from '@/utils/env';
import { projectAccessWhere } from '@/utils/project-access';
import { isPublicHost } from '@/utils/safe-fetch';
import slugify from '@/utils/slugify';
import { generateToken } from '@/utils/token';

let browserInstance: Browser | null = null;

async function getBrowserInstance() {
	if (!browserInstance) {
		browserInstance = await puppeteer.launch({
			headless: true,
			args: ['--no-sandbox', '--disable-setuid-sandbox'],
			defaultViewport: {
				width: 1280,
				height: 720,
			},
		});
	}
	return browserInstance;
}

export const POST = [
	authenticateRequest(),
	async (req: Request, res: Response) => {
		const project = await prisma.project.findFirst({
			where: projectAccessWhere(req.params.id as string, req.userId!),
			include: {
				user: { select: { id: true, name: true } },
			},
		});
		if (!project) return res.status(404).json({ error: 'Project not found' });

		const homePageId = project.homePageId;
		if (!homePageId) return res.status(404).json({ error: 'Home page not found' });

		const browser = await getBrowserInstance();
		const page = await browser.newPage();

		// Tile images are user-supplied URLs, and this browser runs on the server. Let the app and
		// public hosts load; refuse anything that resolves to a private or loopback address.
		const clientOrigin = new URL(CLIENT_HOST).origin;
		const hostChecks = new Map<string, Promise<boolean>>();
		await page.setRequestInterception(true);
		page.on('request', (request) => {
			void (async () => {
				try {
					const url = new URL(request.url());
					if (url.protocol === 'data:' || url.protocol === 'blob:' || url.origin === clientOrigin)
						return await request.continue();
					if (url.protocol !== 'http:' && url.protocol !== 'https:') return await request.abort('blockedbyclient');
					let allowed = hostChecks.get(url.hostname);
					if (!allowed) {
						allowed = isPublicHost(url.hostname);
						hostChecks.set(url.hostname, allowed);
					}
					if (await allowed) await request.continue();
					else await request.abort('blockedbyclient');
				} catch {
					/* The request was already handled or the page closed. */
				}
			})();
		});

		const token = generateToken(req.userId!).token;

		// Inject token into localStorage before any scripts run (fetchFromAPI reads it from localStorage).
		await page.evaluateOnNewDocument((t) => {
			localStorage.setItem('token', t);
		}, token);

		// Also set as a cookie for good measure (some flows may read it).
		await page.setCookie({
			name: 'token',
			value: token,
			domain: new URL(CLIENT_HOST).hostname,
			path: '/',
		});

		await page.goto(`${CLIENT_HOST}/app/project/${project.id}/${homePageId}/thumbnail`);
		await page.waitForNetworkIdle();

		const screenshotBuffer = await page.screenshot({ type: 'png' });

		await page.close();

		const fileName = `${Date.now()}-thumbnail.png`;
		const newThumbnailKey = `${slugify(project.user.name)}-${project.user.id}/${fileName}`;

		await s3.send(
			new PutObjectCommand({
				Bucket: R2_BUCKET,
				Key: newThumbnailKey,
				Body: Buffer.from(screenshotBuffer),
				ContentType: 'image/png',
			}),
		);

		const newImageUrl = `/${newThumbnailKey}`;

		// jsonb_set instead of rewriting the whole blob: a sync can land while the
		// screenshot renders, and a read-modify-write here would revert its page edits.
		await prisma.$executeRaw`
			UPDATE "Project"
			SET "imageUrl" = ${newImageUrl},
			    "blob" = jsonb_set("blob", '{imageUrl}', to_jsonb(${newImageUrl}::text)),
			    "updatedAt" = now()
			WHERE "id" = ${project.id}
		`;

		// Delete the old thumbnail only after the new URL is committed, so a failure
		// anywhere above leaves the record pointing at an object that still exists.
		// Skip shared template thumbnails — they're referenced by every user who imported that template.
		if (project.imageUrl && project.imageUrl !== newImageUrl && !project.imageUrl.startsWith('/template-')) {
			const key = project.imageUrl.split('/').filter(Boolean).join('/');
			try {
				await s3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
			} catch (err) {
				console.warn(`Failed to delete thumbnail ${key}:`, err);
			}
		}

		res.json({ success: true });
	},
];
