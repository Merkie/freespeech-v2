import { GetObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'node:crypto';
import JSZip from 'jszip';
import sharp from 'sharp';
import {
	TEMPLATES,
	type TemplateSource,
	templateAssetKey,
	templateAssetUrl,
	templateBlobKey,
	templateThumbnailKey,
} from '../src/data/templates';
import s3 from '../src/resources/s3';
import type { OBFButton, OBFGrid, OBFImage, OBFPage, OBZManifest } from '../src/utils/open-board-format';
import { R2_BUCKET } from '../src/utils/env';

const THUMBNAIL_SIZE = 800;
const THUMBNAIL_QUALITY = 90;
const TILE_IMAGE_SIZE = 512;
const WEBP_QUALITY = 85;
const IMAGE_CONCURRENCY = 8;
const FETCH_TIMEOUT_MS = 15000;

type AssetExt = 'webp' | 'svg' | 'gif';

type ResolvedAsset = {
	hash: string;
	ext: AssetExt;
	url: string;
};

type PageBlob = {
	id: string;
	name: string;
	tiles: TileBlob[];
};

type TileBlob = {
	x: number;
	y: number;
	page: number;
	text: string;
	displayText?: string;
	backgroundColor?: string;
	borderColor?: string;
	image?: string;
	navigation?: string;
};

type SeedProjectBlob = {
	id: null;
	name: string;
	description: string;
	imageUrl: string | null;
	columns: number;
	rows: number;
	homePageId: string;
	lastEditedAt: string;
	pages: PageBlob[];
};

type ParsedSource = {
	zip: JSZip | null;
	manifest: OBZManifest | null;
	pages: Array<{ fileName: string; data: OBFPage }>;
	rootFileName: string;
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
	const assetCache = new Map<string, ResolvedAsset>();

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

async function seedTemplate(template: TemplateSource, assetCache: Map<string, ResolvedAsset>) {
	const sourceBytes = await downloadFromR2(template.sourceObjectKey);
	const parsed = await parseSource(template.sourceObjectKey, sourceBytes);

	const pageIdByFileName = new Map<string, string>();
	const pageIdByBoardId = new Map<string, string>();
	for (const p of parsed.pages) {
		const id = crypto.randomUUID();
		pageIdByFileName.set(p.fileName, id);
		if (p.data.id) pageIdByBoardId.set(String(p.data.id), id);
	}

	const root = parsed.pages.find((p) => p.fileName === parsed.rootFileName) ?? parsed.pages[0];
	const homePageId = pageIdByFileName.get(root.fileName)!;

	const allImages = collectAllImages(parsed.pages);
	console.log(`   ${parsed.pages.length} page(s), ${allImages.length} image reference(s)`);

	const imageIdToUrlByPage = await resolveImagesParallel(allImages, parsed.zip, assetCache);

	const pages: PageBlob[] = parsed.pages.map(({ fileName, data }) => ({
		id: pageIdByFileName.get(fileName)!,
		name: fileName === root.fileName ? 'Home' : data.name || fileName,
		tiles: buildTilesFromPage(
			data,
			imageIdToUrlByPage.get(fileName) ?? new Map(),
			pageIdByFileName,
			pageIdByBoardId,
		),
	}));

	const thumbnailUrl = await rehostThumbnail(template);

	const blob: SeedProjectBlob = {
		id: null,
		name: template.name,
		description: template.description,
		imageUrl: thumbnailUrl,
		columns: root.data.grid.columns,
		rows: root.data.grid.rows,
		homePageId,
		lastEditedAt: new Date(0).toISOString(),
		pages,
	};

	await putToR2(templateBlobKey(template.slug), Buffer.from(JSON.stringify(blob)), 'application/json');
}

async function parseSource(sourceKey: string, sourceBytes: Buffer): Promise<ParsedSource> {
	if (sourceKey.endsWith('.obf')) {
		const data = JSON.parse(sourceBytes.toString('utf8')) as OBFPage;
		const fileName = sourceKey.split('/').pop() || 'root.obf';
		return { zip: null, manifest: null, pages: [{ fileName, data }], rootFileName: fileName };
	}

	const zip = await JSZip.loadAsync(sourceBytes);

	let manifest: OBZManifest | null = null;
	const manifestEntry = zip.file('manifest.json');
	if (manifestEntry) {
		manifest = JSON.parse(await manifestEntry.async('string')) as OBZManifest;
	}

	const pages: Array<{ fileName: string; data: OBFPage }> = [];
	for (const fileName of Object.keys(zip.files)) {
		if (!fileName.endsWith('.obf')) continue;
		const entry = zip.file(fileName);
		if (!entry) continue;
		const content = await entry.async('string');
		pages.push({ fileName, data: JSON.parse(content) as OBFPage });
	}

	const rootFileName = manifest?.root ?? (pages.find((p) => p.fileName.endsWith('root.obf'))?.fileName || pages[0].fileName);

	return { zip, manifest, pages, rootFileName };
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

async function existsInR2(key: string): Promise<boolean> {
	try {
		await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
		return true;
	} catch {
		return false;
	}
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

const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';

type ImageRef = { pageFileName: string; imageId: string; image: OBFImage };

function collectAllImages(pages: Array<{ fileName: string; data: OBFPage }>): ImageRef[] {
	const refs: ImageRef[] = [];
	for (const page of pages) {
		for (const image of page.data.images || []) {
			refs.push({ pageFileName: page.fileName, imageId: image.id, image });
		}
	}
	return refs;
}

async function resolveImagesParallel(
	refs: ImageRef[],
	zip: JSZip | null,
	assetCache: Map<string, ResolvedAsset>,
): Promise<Map<string, Map<string, string>>> {
	const result = new Map<string, Map<string, string>>();
	let done = 0;
	const total = refs.length;

	let cursor = 0;
	const worker = async () => {
		while (true) {
			const i = cursor++;
			if (i >= refs.length) return;
			const ref = refs[i];
			try {
				const asset = await resolveImage(ref.image, zip, assetCache);
				if (asset) {
					let pageMap = result.get(ref.pageFileName);
					if (!pageMap) {
						pageMap = new Map();
						result.set(ref.pageFileName, pageMap);
					}
					pageMap.set(ref.imageId, asset.url);
				}
			} catch (err) {
				console.warn(`     image error ${ref.imageId}: ${err instanceof Error ? err.message : err}`);
			}
			done++;
			if (done % 25 === 0 || done === total) {
				console.log(`     images ${done}/${total}`);
			}
		}
	};

	await Promise.all(Array.from({ length: Math.min(IMAGE_CONCURRENCY, total) }, worker));
	return result;
}

async function resolveImage(
	image: OBFImage,
	zip: JSZip | null,
	cache: Map<string, ResolvedAsset>,
): Promise<ResolvedAsset | null> {
	const cacheKey =
		image.url ?? (image.path ? `zip:${image.path}` : image.data ? `data:${sha(image.data).slice(0, 16)}` : null);
	if (!cacheKey) return null;

	const cached = cache.get(cacheKey);
	if (cached) return cached;

	let bytes: Buffer | null = null;
	let contentType = image.content_type || '';

	// Prefer the canonical URL over the zip-embedded copy: OBZ bundlers sometimes flatten transparency
	// (e.g. CommuniKate 20's zip stores opaque PNGs with white backgrounds, while OpenSymbols serves
	// proper transparent versions). This matches the original FreeSpeech import, which used image.url.
	if (image.url) {
		try {
			const res = await fetch(image.url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
			if (res.ok) {
				bytes = Buffer.from(await res.arrayBuffer());
				if (!contentType) contentType = res.headers.get('content-type') || inferContentTypeFromPath(image.url);
			} else {
				console.warn(`     url HTTP ${res.status}, falling back: ${image.url}`);
			}
		} catch {
			console.warn(`     url fetch failed, falling back: ${image.url}`);
		}
	}

	if (!bytes && image.path && zip) {
		const file = zip.file(image.path);
		if (file) {
			bytes = Buffer.from(await file.async('uint8array'));
			if (!contentType) contentType = inferContentTypeFromPath(image.path);
		}
	}

	if (!bytes && image.data) {
		const decoded = decodeDataUrl(image.data);
		if (decoded) {
			bytes = decoded.bytes;
			if (!contentType) contentType = decoded.contentType;
		}
	}

	if (!bytes) return null;

	const hash = sha(bytes);
	const asset = await rehostAsset(hash, bytes, contentType);
	cache.set(cacheKey, asset);
	return asset;
}

async function rehostAsset(hash: string, sourceBytes: Buffer, contentType: string): Promise<ResolvedAsset> {
	const normalized = contentType.toLowerCase();

	if (normalized.includes('svg')) {
		const key = templateAssetKey(hash, 'svg');
		if (!(await existsInR2(key))) await putToR2(key, sourceBytes, 'image/svg+xml', IMMUTABLE_CACHE);
		return { hash, ext: 'svg', url: templateAssetUrl(hash, 'svg') };
	}

	if (normalized.includes('gif')) {
		const key = templateAssetKey(hash, 'gif');
		if (!(await existsInR2(key))) await putToR2(key, sourceBytes, 'image/gif', IMMUTABLE_CACHE);
		return { hash, ext: 'gif', url: templateAssetUrl(hash, 'gif') };
	}

	const key = templateAssetKey(hash, 'webp');
	if (!(await existsInR2(key))) {
		const webp = await sharp(sourceBytes)
			.resize(TILE_IMAGE_SIZE, TILE_IMAGE_SIZE, { fit: 'inside', withoutEnlargement: true })
			.webp({ quality: WEBP_QUALITY })
			.toBuffer();
		await putToR2(key, webp, 'image/webp', IMMUTABLE_CACHE);
	}
	return { hash, ext: 'webp', url: templateAssetUrl(hash, 'webp') };
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

function buildTilesFromPage(
	page: OBFPage,
	imageIdToUrl: Map<string, string>,
	pageIdByFileName: Map<string, string>,
	pageIdByBoardId: Map<string, string>,
): TileBlob[] {
	const grid: OBFGrid = page.grid;
	const tiles: TileBlob[] = [];
	const buttonById = new Map<string, OBFButton>();
	for (const b of page.buttons) {
		buttonById.set(String(b.id), b);
	}

	for (let y = 0; y < grid.order.length; y++) {
		const row = grid.order[y];
		for (let x = 0; x < row.length; x++) {
			const cell = row[x];
			if (cell === null || cell === undefined) continue;
			const button = buttonById.get(String(cell));
			if (!button) continue;

			const image = button.image_id ? imageIdToUrl.get(button.image_id) : undefined;
			const navigation = resolveLoadBoard(button, pageIdByFileName, pageIdByBoardId);

			const tile: TileBlob = {
				x,
				y,
				page: 0,
				text: button.label || '',
			};
			if (button.vocalization && button.vocalization !== button.label) {
				tile.displayText = button.vocalization;
			}
			if (button.background_color) tile.backgroundColor = button.background_color;
			if (button.border_color) tile.borderColor = button.border_color;
			if (image) tile.image = image;
			if (navigation) tile.navigation = navigation;

			tiles.push(tile);
		}
	}

	return tiles;
}

function resolveLoadBoard(
	button: OBFButton,
	pageIdByFileName: Map<string, string>,
	pageIdByBoardId: Map<string, string>,
): string | undefined {
	const lb = button.load_board;
	if (!lb) return undefined;
	if (lb.path && pageIdByFileName.has(lb.path)) return pageIdByFileName.get(lb.path);
	if (lb.id && pageIdByBoardId.has(String(lb.id))) return pageIdByBoardId.get(String(lb.id));
	return undefined;
}

function inferContentTypeFromPath(path: string): string {
	const lower = path.toLowerCase().split('?')[0];
	if (lower.endsWith('.svg')) return 'image/svg+xml';
	if (lower.endsWith('.png')) return 'image/png';
	if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
	if (lower.endsWith('.gif')) return 'image/gif';
	if (lower.endsWith('.webp')) return 'image/webp';
	return 'application/octet-stream';
}

function decodeDataUrl(data: string): { bytes: Buffer; contentType: string } | null {
	const match = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(data);
	if (!match) return null;
	const contentType = match[1];
	const isBase64 = !!match[2];
	const payload = match[3];
	const bytes = isBase64 ? Buffer.from(payload, 'base64') : Buffer.from(decodeURIComponent(payload));
	return { bytes, contentType };
}

function sha(input: Buffer | string): string {
	return crypto
		.createHash('sha256')
		.update(typeof input === 'string' ? Buffer.from(input) : input)
		.digest('hex');
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
