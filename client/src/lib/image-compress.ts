const MAX_LONGEST_SIDE = 512;
const WEBP_QUALITY = 0.85;
const JPEG_QUALITY = 0.85;
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

const PASSTHROUGH_TYPES = new Set(['image/svg+xml', 'image/gif']);

export type CompressedImage = {
	blob: Blob;
	filename: string;
};

export async function compressImage(file: File): Promise<CompressedImage> {
	if (!file.type.startsWith('image/') || PASSTHROUGH_TYPES.has(file.type)) {
		return { blob: file, filename: file.name };
	}

	let source: ImageBitmap | HTMLImageElement;
	try {
		source = await loadImage(file);
	} catch {
		return { blob: file, filename: file.name };
	}

	try {
		const { width, height } = getDimensions(source);
		if (!width || !height) {
			return { blob: file, filename: file.name };
		}

		const longest = Math.max(width, height);
		const scale = longest > MAX_LONGEST_SIDE ? MAX_LONGEST_SIDE / longest : 1;
		const targetW = Math.max(1, Math.round(width * scale));
		const targetH = Math.max(1, Math.round(height * scale));

		const canvas = createCanvas(targetW, targetH);
		const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
		if (!ctx) {
			return { blob: file, filename: file.name };
		}

		ctx.drawImage(source as CanvasImageSource, 0, 0, targetW, targetH);

		const webpBlob = await canvasToBlob(canvas, 'image/webp', WEBP_QUALITY);
		if (webpBlob && webpBlob.type === 'image/webp') {
			return { blob: webpBlob, filename: renameForVariant(file.name, 'webp') };
		}

		const jpegBlob = await canvasToBlob(canvas, 'image/jpeg', JPEG_QUALITY);
		if (jpegBlob) {
			return { blob: jpegBlob, filename: renameForVariant(file.name, 'jpg') };
		}

		return { blob: file, filename: file.name };
	} finally {
		if ('close' in source && typeof source.close === 'function') {
			source.close();
		}
	}
}

async function loadImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
	if (typeof createImageBitmap === 'function') {
		try {
			return await createImageBitmap(file);
		} catch {
			// fall through to <img> element
		}
	}
	return loadViaImageElement(file);
}

function loadViaImageElement(file: File): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(file);
		const img = new Image();
		img.onload = () => {
			URL.revokeObjectURL(url);
			resolve(img);
		};
		img.onerror = (err) => {
			URL.revokeObjectURL(url);
			reject(err);
		};
		img.src = url;
	});
}

function getDimensions(source: ImageBitmap | HTMLImageElement): { width: number; height: number } {
	if (source instanceof HTMLImageElement) {
		return { width: source.naturalWidth, height: source.naturalHeight };
	}
	return { width: source.width, height: source.height };
}

function createCanvas(w: number, h: number): HTMLCanvasElement | OffscreenCanvas {
	if (typeof OffscreenCanvas !== 'undefined') {
		return new OffscreenCanvas(w, h);
	}
	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	return canvas;
}

async function canvasToBlob(
	canvas: HTMLCanvasElement | OffscreenCanvas,
	type: string,
	quality: number,
): Promise<Blob | null> {
	if ('convertToBlob' in canvas) {
		try {
			return await canvas.convertToBlob({ type, quality });
		} catch {
			return null;
		}
	}
	return new Promise((resolve) => {
		canvas.toBlob((blob) => resolve(blob), type, quality);
	});
}

function renameForVariant(originalName: string, ext: 'webp' | 'jpg'): string {
	const dot = originalName.lastIndexOf('.');
	const baseRaw = dot > 0 ? originalName.slice(0, dot) : originalName;
	const base = baseRaw.replace(/-(512|original|optimized)$/i, '');
	return `${base}-512.${ext}`;
}
