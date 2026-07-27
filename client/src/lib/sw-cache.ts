/**
 * Caching primitives for the service worker.
 *
 * These live outside sw.ts so they can be exercised without a worker global. The rule they all
 * exist to enforce is that **a cache write must never affect what the page receives**.
 *
 * Workbox's stock strategies rethrow QuotaExceededError out of cache.put(). In CacheFirst that
 * leaves the strategy with no response, so it throws `no-response` and respondWith() rejects —
 * a successful network fetch is reported to the page as a failed one. On a board whose images
 * total 145 MB that happens within the first few tiles and every image goes blank while the
 * network is working perfectly, which is exactly what an installed PWA on an old iPad showed.
 * iOS gives such a PWA a small Cache Storage quota and pads opaque cross-origin responses heavily
 * against it, so this is the normal case there rather than an edge one.
 */

// A single tile image should never be worth a large slice of the whole quota. Boards imported
// from other AAC apps can carry multi-megabyte photos, and one of those evicting everything else
// is worse than not caching it at all.
export const MAX_CACHEABLE_IMAGE_BYTES = 2 * 1024 * 1024;

/**
 * A cache read that can miss but never throw. Reads need the same rule as writes: on a device
 * whose storage is in a bad state (full disk, corrupted store — old iPads manage both),
 * caches.match() can *reject* rather than miss, and an unguarded read would fail the request
 * even though the network is fine.
 */
export async function safeCacheMatch(cacheName: string, request: Request): Promise<Response | undefined> {
	try {
		return await caches.match(request, { cacheName });
	} catch {
		return undefined;
	}
}

/** Drops the oldest entries until at most `maxEntries` remain. */
export async function trimCache(cache: Cache, maxEntries: number): Promise<void> {
	const keys = await cache.keys();
	const excess = keys.length - maxEntries;
	// Guard the under-cap case explicitly: slice(0, negative) counts back from the end and would
	// delete nearly everything instead of nothing.
	if (excess <= 0) return;
	// Cache.keys() is in insertion order, so the front of the list is the oldest entry.
	for (const key of keys.slice(0, excess)) {
		await cache.delete(key);
	}
}

/**
 * Stores a response, and gives up quietly if it cannot. Never rejects.
 *
 * On a quota failure the cache is halved so later writes have somewhere to go — the alternative
 * Workbox offers (purgeOnQuotaError) empties it completely, which just means the next page load
 * refills it and hits the same wall.
 */
export async function cacheBestEffort(
	cacheName: string,
	request: Request,
	response: Response,
	maxEntries: number,
): Promise<void> {
	try {
		const cache = await caches.open(cacheName);
		await cache.put(request, response);
		await trimCache(cache, maxEntries);
	} catch {
		try {
			const cache = await caches.open(cacheName);
			await trimCache(cache, Math.floor(maxEntries / 2));
		} catch {
			// Nothing further to try. The caller already holds the response it needs.
		}
	}
}

/**
 * Whether an image response is worth storing.
 *
 * A cross-origin image is fetched no-cors, so what comes back is opaque: status 0, headers
 * hidden, body unreadable. There is no way to tell a real image from an error page or to measure
 * it. Store it anyway — nearly all tile art is cross-origin and offline boards are the point of
 * the app — and rely on the entry cap to bound the damage. Anything we *can* inspect gets checked.
 */
export function isWorthCaching(response: Response): boolean {
	if (response.type === 'opaque') return true;
	if (!response.ok) return false;
	return Number(response.headers.get('content-length') ?? 0) <= MAX_CACHEABLE_IMAGE_BYTES;
}

/**
 * Cache-first, falling back to the network. The cache write is fire-and-forget: the response is
 * returned without waiting on it, and a failed write is invisible to the page.
 */
export async function handleImage(
	request: Request,
	cacheName: string,
	maxEntries: number,
	event?: { waitUntil(promise: Promise<unknown>): void },
): Promise<Response> {
	const cached = await safeCacheMatch(cacheName, request);
	if (cached) return cached;

	const response = await fetch(request);
	if (isWorthCaching(response)) {
		// waitUntil only keeps the worker alive long enough to finish the write; the response has
		// already been handed back by then.
		event?.waitUntil(cacheBestEffort(cacheName, request, response.clone(), maxEntries));
	}
	return response;
}

/**
 * Network-first, so a board edited on another device is never served stale while online. Offline
 * falls back to whatever was seen last; project contents themselves live in IndexedDB (see
 * lib/cache/blob-cache.ts), which is the real offline story.
 */
export async function handleApi(
	request: Request,
	cacheName: string,
	maxEntries: number,
	event?: { waitUntil(promise: Promise<unknown>): void },
): Promise<Response> {
	try {
		const response = await fetch(request);
		if (response.ok) {
			event?.waitUntil(cacheBestEffort(cacheName, request, response.clone(), maxEntries));
		}
		return response;
	} catch (error) {
		const cached = await safeCacheMatch(cacheName, request);
		if (cached) return cached;
		throw error;
	}
}
