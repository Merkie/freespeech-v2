/**
 * Open Board Format (.obf / .obz) → ProjectBlob.
 *
 * Shared by the starter-template seeder and the user-facing import route. The only thing that
 * differs between them is where images end up, so that is injected as an AssetStore: templates
 * write to a shared content-addressed prefix that every user's copy points at, while a user's
 * own import gets its images under their own prefix.
 */

import crypto from 'node:crypto';
import JSZip from 'jszip';
import sharp from 'sharp';
import type { OBFButton, OBFGrid, OBFImage, OBFPage, OBZManifest } from './open-board-format';

export const TILE_IMAGE_SIZE = 512;
export const WEBP_QUALITY = 85;
const IMAGE_CONCURRENCY = 8;
const FETCH_TIMEOUT_MS = 15000;

export type AssetExt = 'webp' | 'svg' | 'gif';

export type ResolvedAsset = {
	hash: string;
	ext: AssetExt;
	url: string;
};

/**
 * Keyed by image source (url / zip path / data hash), holding the in-flight promise rather than
 * the finished asset. Boards reference the same symbol many times and images are resolved eight
 * at a time, so caching the settled value alone would let concurrent workers fetch, transcode and
 * upload identical bytes several times over before the first one finished.
 */
export type AssetCache = Map<string, Promise<ResolvedAsset | null>>;

/**
 * Where resolved images are written. `put` is only called when `has` says the object is missing,
 * so identical bytes are stored once and reused.
 */
export type AssetStore = {
	has(hash: string, ext: AssetExt): Promise<boolean>;
	put(hash: string, ext: AssetExt, bytes: Buffer, contentType: string): Promise<void>;
	url(hash: string, ext: AssetExt): string;
};

export type ImportedTile = {
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

export type ImportedPage = {
	id: string;
	name: string;
	tiles: ImportedTile[];
};

export type ParsedSource = {
	zip: JSZip | null;
	manifest: OBZManifest | null;
	pages: Array<{ fileName: string; data: OBFPage }>;
	rootFileName: string;
};

export type ImportedProject = {
	name: string;
	columns: number;
	rows: number;
	homePageId: string;
	pages: ImportedPage[];
	imagesResolved: number;
	imagesTotal: number;
};

export class OpenBoardParseError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'OpenBoardParseError';
	}
}

// --- Parsing ---

export async function parseOpenBoardSource(fileName: string, bytes: Buffer): Promise<ParsedSource> {
	if (fileName.toLowerCase().endsWith('.obf')) {
		let data: OBFPage;
		try {
			data = JSON.parse(bytes.toString('utf8')) as OBFPage;
		} catch {
			throw new OpenBoardParseError('That .obf file is not valid JSON.');
		}
		assertBoardShape(data, fileName);
		const name = fileName.split('/').pop() || 'root.obf';
		return { zip: null, manifest: null, pages: [{ fileName: name, data }], rootFileName: name };
	}

	let zip: JSZip;
	try {
		zip = await JSZip.loadAsync(bytes);
	} catch {
		throw new OpenBoardParseError('That .obz file could not be opened as an archive.');
	}

	let manifest: OBZManifest | null = null;
	const manifestEntry = zip.file('manifest.json');
	if (manifestEntry) {
		try {
			manifest = JSON.parse(await manifestEntry.async('string')) as OBZManifest;
		} catch {
			// A malformed manifest is recoverable: the root board can still be guessed below.
			manifest = null;
		}
	}

	const pages: Array<{ fileName: string; data: OBFPage }> = [];
	for (const name of Object.keys(zip.files)) {
		if (!name.endsWith('.obf')) continue;
		const entry = zip.file(name);
		if (!entry) continue;
		const content = await entry.async('string');
		let data: OBFPage;
		try {
			data = JSON.parse(content) as OBFPage;
		} catch {
			throw new OpenBoardParseError(`The board "${name}" inside that archive is not valid JSON.`);
		}
		assertBoardShape(data, name);
		pages.push({ fileName: name, data });
	}

	if (pages.length === 0) {
		throw new OpenBoardParseError('That archive does not contain any .obf boards.');
	}

	const rootFileName =
		(manifest?.root && pages.some((p) => p.fileName === manifest.root) ? manifest.root : null) ??
		pages.find((p) => p.fileName.endsWith('root.obf'))?.fileName ??
		pages[0].fileName;

	return { zip, manifest, pages, rootFileName };
}

function assertBoardShape(data: unknown, fileName: string): asserts data is OBFPage {
	const board = data as Partial<OBFPage> | null;
	if (!board || typeof board !== 'object') {
		throw new OpenBoardParseError(`"${fileName}" is not an Open Board Format board.`);
	}
	if (!Array.isArray(board.buttons)) {
		throw new OpenBoardParseError(`"${fileName}" has no buttons array.`);
	}
	if (!board.grid || !Array.isArray(board.grid.order)) {
		throw new OpenBoardParseError(`"${fileName}" has no grid.`);
	}
}

// --- Full import ---

export async function buildProjectFromOpenBoard(
	parsed: ParsedSource,
	store: AssetStore,
	options?: {
		/** Shared across calls to dedupe identical images between boards. */
		assetCache?: AssetCache;
		/** Prefer the canonical image URL over the copy embedded in the archive. */
		preferRemoteImages?: boolean;
		fallbackName?: string;
		onProgress?: (done: number, total: number) => void;
	},
): Promise<ImportedProject> {
	const assetCache: AssetCache = options?.assetCache ?? new Map();

	const pageIdByFileName = new Map<string, string>();
	const pageIdByBoardId = new Map<string, string>();
	for (const p of parsed.pages) {
		const id = crypto.randomUUID();
		pageIdByFileName.set(p.fileName, id);
		if (p.data.id) pageIdByBoardId.set(String(p.data.id), id);
	}

	const root = parsed.pages.find((p) => p.fileName === parsed.rootFileName) ?? parsed.pages[0];
	const homePageId = pageIdByFileName.get(root.fileName) as string;

	const refs = collectAllImages(parsed.pages);
	const { byPage, resolved } = await resolveImagesParallel(refs, parsed.zip, assetCache, store, {
		preferRemoteImages: options?.preferRemoteImages ?? true,
		onProgress: options?.onProgress,
	});

	const pages: ImportedPage[] = parsed.pages.map(({ fileName, data }) => ({
		id: pageIdByFileName.get(fileName) as string,
		// The entry board is always called Home so the app's home-page logic lines up.
		name: fileName === root.fileName ? 'Home' : data.name || fileName,
		tiles: buildTilesFromPage(data, byPage.get(fileName) ?? new Map(), pageIdByFileName, pageIdByBoardId),
	}));

	return {
		name: root.data.name || options?.fallbackName || 'Imported Board',
		columns: Math.max(1, Math.min(20, root.data.grid.columns || 1)),
		rows: Math.max(1, Math.min(20, root.data.grid.rows || 1)),
		homePageId,
		pages,
		imagesResolved: resolved,
		imagesTotal: refs.length,
	};
}

// --- Images ---

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
	assetCache: AssetCache,
	store: AssetStore,
	options: { preferRemoteImages: boolean; onProgress?: (done: number, total: number) => void },
): Promise<{ byPage: Map<string, Map<string, string>>; resolved: number }> {
	const byPage = new Map<string, Map<string, string>>();
	let done = 0;
	let resolved = 0;
	let cursor = 0;

	const worker = async () => {
		while (true) {
			const i = cursor++;
			if (i >= refs.length) return;
			const ref = refs[i];
			try {
				const asset = await resolveImage(ref.image, zip, assetCache, store, options.preferRemoteImages);
				if (asset) {
					let pageMap = byPage.get(ref.pageFileName);
					if (!pageMap) {
						pageMap = new Map();
						byPage.set(ref.pageFileName, pageMap);
					}
					pageMap.set(ref.imageId, asset.url);
					resolved++;
				}
			} catch (err) {
				// One unreachable symbol must not fail a whole board — that tile just loses its image.
				console.warn(`image error ${ref.imageId}: ${err instanceof Error ? err.message : err}`);
			}
			done++;
			options.onProgress?.(done, refs.length);
		}
	};

	await Promise.all(Array.from({ length: Math.min(IMAGE_CONCURRENCY, refs.length) }, worker));
	return { byPage, resolved };
}

export function resolveImage(
	image: OBFImage,
	zip: JSZip | null,
	cache: AssetCache,
	store: AssetStore,
	preferRemote: boolean,
): Promise<ResolvedAsset | null> {
	const cacheKey =
		image.url ?? (image.path ? `zip:${image.path}` : image.data ? `data:${sha(image.data).slice(0, 16)}` : null);
	if (!cacheKey) return Promise.resolve(null);

	const inFlight = cache.get(cacheKey);
	if (inFlight) return inFlight;

	// Register the promise before awaiting anything, so a worker that asks for the same image a
	// moment later joins this attempt instead of starting its own.
	const work = resolveImageUncached(image, zip, store, preferRemote);
	cache.set(cacheKey, work);
	return work;
}

async function resolveImageUncached(
	image: OBFImage,
	zip: JSZip | null,
	store: AssetStore,
	preferRemote: boolean,
): Promise<ResolvedAsset | null> {
	let bytes: Buffer | null = null;
	let contentType = image.content_type || '';

	// Prefer the canonical URL over the zip-embedded copy: OBZ bundlers sometimes flatten
	// transparency (CommuniKate 20's archive stores opaque PNGs on white, while OpenSymbols serves
	// proper transparent versions).
	if (preferRemote && image.url) {
		try {
			const res = await fetch(image.url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
			if (res.ok) {
				bytes = Buffer.from(await res.arrayBuffer());
				if (!contentType) contentType = res.headers.get('content-type') || inferContentTypeFromPath(image.url);
			}
		} catch {
			// Fall through to the archive copy.
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

	// Last resort: the board pointed at a URL but we were told to prefer the archive and it had no
	// local copy.
	if (!bytes && !preferRemote && image.url) {
		try {
			const res = await fetch(image.url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
			if (res.ok) {
				bytes = Buffer.from(await res.arrayBuffer());
				if (!contentType) contentType = res.headers.get('content-type') || inferContentTypeFromPath(image.url);
			}
		} catch {
			// Give up on this image.
		}
	}

	if (!bytes) return null;

	const hash = sha(bytes);
	return rehostAsset(hash, bytes, contentType, store);
}

async function rehostAsset(
	hash: string,
	sourceBytes: Buffer,
	contentType: string,
	store: AssetStore,
): Promise<ResolvedAsset> {
	const normalized = contentType.toLowerCase();

	// SVG and GIF are passed through: rasterising an SVG loses its scalability, and encoding a GIF
	// to still WebP would drop the animation.
	if (normalized.includes('svg')) {
		if (!(await store.has(hash, 'svg'))) await store.put(hash, 'svg', sourceBytes, 'image/svg+xml');
		return { hash, ext: 'svg', url: store.url(hash, 'svg') };
	}

	if (normalized.includes('gif')) {
		if (!(await store.has(hash, 'gif'))) await store.put(hash, 'gif', sourceBytes, 'image/gif');
		return { hash, ext: 'gif', url: store.url(hash, 'gif') };
	}

	if (!(await store.has(hash, 'webp'))) {
		const webp = await sharp(sourceBytes)
			.resize(TILE_IMAGE_SIZE, TILE_IMAGE_SIZE, { fit: 'inside', withoutEnlargement: true })
			.webp({ quality: WEBP_QUALITY })
			.toBuffer();
		await store.put(hash, 'webp', webp, 'image/webp');
	}
	return { hash, ext: 'webp', url: store.url(hash, 'webp') };
}

// --- Tiles ---

export function buildTilesFromPage(
	page: OBFPage,
	imageIdToUrl: Map<string, string>,
	pageIdByFileName: Map<string, string>,
	pageIdByBoardId: Map<string, string>,
): ImportedTile[] {
	const grid: OBFGrid = page.grid;
	const tiles: ImportedTile[] = [];
	const buttonById = new Map<string, OBFButton>();
	for (const b of page.buttons) {
		buttonById.set(String(b.id), b);
	}

	for (let y = 0; y < grid.order.length; y++) {
		const row = grid.order[y];
		if (!Array.isArray(row)) continue;
		for (let x = 0; x < row.length; x++) {
			const cell = row[x];
			if (cell === null || cell === undefined) continue;
			const button = buttonById.get(String(cell));
			if (!button) continue;

			const image = button.image_id ? imageIdToUrl.get(button.image_id) : undefined;
			const navigation = resolveLoadBoard(button, pageIdByFileName, pageIdByBoardId);

			const tile: ImportedTile = { x, y, page: 0, text: button.label || '' };
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

export function resolveLoadBoard(
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

// --- Small helpers ---

export function inferContentTypeFromPath(path: string): string {
	const lower = path.toLowerCase().split('?')[0];
	if (lower.endsWith('.svg')) return 'image/svg+xml';
	if (lower.endsWith('.png')) return 'image/png';
	if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
	if (lower.endsWith('.gif')) return 'image/gif';
	if (lower.endsWith('.webp')) return 'image/webp';
	return 'application/octet-stream';
}

export function decodeDataUrl(data: string): { bytes: Buffer; contentType: string } | null {
	const match = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(data);
	if (!match) return null;
	const contentType = match[1];
	const isBase64 = !!match[2];
	const payload = match[3];
	const bytes = isBase64 ? Buffer.from(payload, 'base64') : Buffer.from(decodeURIComponent(payload));
	return { bytes, contentType };
}

export function sha(input: Buffer | string): string {
	return crypto
		.createHash('sha256')
		.update(typeof input === 'string' ? Buffer.from(input) : input)
		.digest('hex');
}
