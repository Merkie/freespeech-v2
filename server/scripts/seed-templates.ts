import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { TEMPLATES, type TemplateSource, templateBlobKey, templateThumbnailKey } from '../src/data/templates';
import { templateAssetStore } from '../src/resources/asset-store';
import s3 from '../src/resources/s3';
import { R2_BUCKET } from '../src/utils/env';
import { type AssetCache, buildProjectFromOpenBoard, parseOpenBoardSource } from '../src/utils/open-board-import';

// Parsing, image resolution and tile building live in src/utils/open-board-import.ts, shared with
// the user-facing import route so both paths behave identically. The only difference here is that
// images go to the shared template-assets prefix, letting every user's copy of a starter board
// point at the same objects instead of duplicating a few thousand symbols per person.

const THUMBNAIL_SIZE = 800;
const THUMBNAIL_QUALITY = 90;
const FETCH_TIMEOUT_MS = 15000;

type SeedProjectBlob = {
	id: null;
	name: string;
	description: string;
	imageUrl: string | null;
	columns: number;
	rows: number;
	homePageId: string;
	lastEditedAt: string;
	pages: Awaited<ReturnType<typeof buildProjectFromOpenBoard>>['pages'];
};

async function main() {
	const thumbnailsOnly = process.argv.includes('--thumbnails-only');

	if (thumbnailsOnly) {
		console.log(`Re-seeding thumbnails for ${TEMPLATES.length} template(s)\n`);
		for (const template of TEMPLATES) {
			console.log(`── ${template.slug}`);
			try {
				const url = await rehostThumbnail(template);
				console.log(`   done → ${url}`);
			} catch (err) {
				console.error(`   FAILED:`, err instanceof Error ? err.message : err);
			}
		}
		return;
	}

	console.log(`Seeding ${TEMPLATES.length} template(s)\n`);
	const assetCache: AssetCache = new Map();

	for (const template of TEMPLATES) {
		console.log(`── ${template.slug}`);
		try {
			await seedTemplate(template, assetCache);
			console.log(`   done`);
		} catch (err) {
			console.error(`   FAILED:`, err instanceof Error ? err.message : err);
		}
	}

	console.log(`\nAsset cache: ${assetCache.size} unique images across all templates`);
}

async function seedTemplate(template: TemplateSource, assetCache: AssetCache) {
	const sourceBytes = await downloadFromR2(template.sourceObjectKey);
	const parsed = await parseOpenBoardSource(template.sourceObjectKey, sourceBytes);

	console.log(`   ${parsed.pages.length} page(s)`);

	const imported = await buildProjectFromOpenBoard(parsed, templateAssetStore, {
		assetCache,
		fallbackName: template.name,
		onProgress: (done, total) => {
			if (done % 25 === 0 || done === total) console.log(`     images ${done}/${total}`);
		},
	});

	const thumbnailUrl = await rehostThumbnail(template);

	const blob: SeedProjectBlob = {
		id: null,
		name: template.name,
		description: template.description,
		imageUrl: thumbnailUrl,
		columns: imported.columns,
		rows: imported.rows,
		homePageId: imported.homePageId,
		lastEditedAt: new Date(0).toISOString(),
		pages: imported.pages,
	};

	await putToR2(templateBlobKey(template.slug), Buffer.from(JSON.stringify(blob)), 'application/json');
}

async function downloadFromR2(key: string): Promise<Buffer> {
	const resp = await s3.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }));
	if (!resp.Body) throw new Error(`Empty body for ${key}`);
	const chunks: Buffer[] = [];
	for await (const chunk of resp.Body as AsyncIterable<Uint8Array>) {
		chunks.push(Buffer.from(chunk));
	}
	return Buffer.concat(chunks);
}

async function putToR2(key: string, body: Buffer, contentType: string, cacheControl?: string) {
	await s3.send(
		new PutObjectCommand({
			Bucket: R2_BUCKET,
			Key: key,
			Body: body,
			ContentType: contentType,
			CacheControl: cacheControl,
		}),
	);
}

async function rehostThumbnail(template: TemplateSource): Promise<string> {
	const isSvg = template.sourceThumbnailUrl.toLowerCase().endsWith('.svg');
	const ext: 'webp' | 'svg' = isSvg ? 'svg' : 'webp';
	const key = templateThumbnailKey(template.slug, ext);
	const imagePath = `/${key}`;

	// Always re-upload thumbnails (there are only ~15) so seed-script tuning propagates.
	const res = await fetch(template.sourceThumbnailUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
	if (!res.ok) throw new Error(`Failed to fetch thumbnail ${template.sourceThumbnailUrl} (${res.status})`);
	const bytes = Buffer.from(await res.arrayBuffer());

	if (isSvg) {
		await putToR2(key, bytes, 'image/svg+xml');
	} else {
		const webp = await sharp(bytes)
			.resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: 'inside', withoutEnlargement: true })
			.webp({ quality: THUMBNAIL_QUALITY })
			.toBuffer();
		await putToR2(key, webp, 'image/webp');
	}

	return imagePath;
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
