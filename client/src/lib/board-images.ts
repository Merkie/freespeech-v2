import { createSignal } from 'solid-js';
import type { ProjectBlob } from './types';

export const BOARD_IMAGE_CACHE_PREFIX = 'freespeech-board-images-';
export type BoardImageStatus = { id: string; total: number; saved: number; downloading: boolean; failed: boolean };
export const [boardImageStatus, setBoardImageStatus] = createSignal<BoardImageStatus | null>(null);
let epoch = 0;
const controllers = new Set<AbortController>();
const jobs = new Map<string, Promise<void>>();
const removedBoards = new Set<string>();

export function boardImageUrls(blob: ProjectBlob): string[] {
	return [
		...new Set(
			blob.pages
				.flatMap((page) => page.tiles.map((tile) => tile.image))
				.filter((url): url is string => !!url && /^https?:\/\//.test(url)),
		),
	];
}

export async function cancelBoardImageDownloads() {
	epoch++;
	for (const controller of controllers) controller.abort();
	await Promise.allSettled([...jobs.values()]);
	setBoardImageStatus(null);
}

/** Keep the board's complete art separate from the worker's small opportunistic image cache. */
export async function saveBoardImages(blob: ProjectBlob): Promise<void> {
	if (removedBoards.has(blob.id)) return;
	const generation = epoch;
	const previous = jobs.get(blob.id);
	if (previous) {
		await previous;
		if (generation !== epoch || removedBoards.has(blob.id)) return;
		return saveBoardImages(blob);
	}
	const task = async () => {
		const urls = boardImageUrls(blob);
		const status: BoardImageStatus = { id: blob.id, total: urls.length, saved: 0, downloading: true, failed: false };
		const report = () => {
			if (epoch === generation) setBoardImageStatus({ ...status });
		};
		report();
		try {
			const cache = await caches.open(BOARD_IMAGE_CACHE_PREFIX + blob.id);
			let index = 0;
			await Promise.all(
				Array.from({ length: 3 }, async () => {
					while (index < urls.length && generation === epoch && !removedBoards.has(blob.id)) {
						const url = urls[index++];
						try {
							if (!(await cache.match(url, { ignoreVary: true }))) {
								if (!navigator.onLine) continue;
								const controller = new AbortController();
								controllers.add(controller);
								const timer = setTimeout(() => controller.abort(), 10000);
								try {
									// CORS avoids WebKit's large opaque-response quota padding and lets us reject
									// broken images. Hosts without CORS remain usable online and report incomplete.
									const response = await fetch(url, { mode: 'cors', credentials: 'omit', signal: controller.signal });
									if (!response.ok || !response.headers.get('content-type')?.startsWith('image/'))
										throw new Error('Image unavailable');
									if (generation !== epoch || removedBoards.has(blob.id)) return;
									await cache.put(url, response);
								} finally {
									clearTimeout(timer);
									controllers.delete(controller);
								}
							}
							status.saved++;
						} catch {
							status.failed = true;
						}
						report();
					}
				}),
			);
			if (generation === epoch && status.saved === urls.length) {
				const keep = new Set(urls);
				for (const key of await cache.keys()) if (!keep.has(key.url)) await cache.delete(key);
			}
		} catch {
			status.failed = true;
		}
		status.downloading = false;
		report();
	};
	const promise = task().finally(() => {
		if (jobs.get(blob.id) === promise) jobs.delete(blob.id);
	});
	jobs.set(blob.id, promise);
	return promise;
}

export async function removeBoardImages(projectId: string): Promise<void> {
	removedBoards.add(projectId);
	await jobs.get(projectId);
	try {
		await caches.delete(BOARD_IMAGE_CACHE_PREFIX + projectId);
	} catch {
		/* Best effort. */
	}
	removedBoards.delete(projectId);
}
