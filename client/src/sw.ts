/// <reference lib="webworker" />

import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';

declare let self: ServiceWorkerGlobalScope;

// Precache all static assets.
//
// Bootstrap Icons ships a @font-face whose src carries a bare 32-hex cache-buster
// (bootstrap-icons.woff2?e348…). Vite hashes and rewrites the path but keeps that query, while
// the precache manifest stores the bare path — so without this the font lookup misses the
// precache, falls through to the network, and every icon is a blank box offline.
precacheAndRoute(self.__WB_MANIFEST, {
	ignoreURLParametersMatching: [/^utm_/, /^fbclid$/, /^[0-9a-f]{32}$/],
});

// Clean up old caches
cleanupOutdatedCaches();

// The API this build talks to. Deployments differ (api.freespeechaac.com in production,
// api-v2.freespeechaac.com for the v2 preview), so routes match on it instead of a literal.
const API_BASE_URL = import.meta.env.VITE_API_URL as string;
const API_ORIGIN = new URL(API_BASE_URL).origin;

// Cache names
const CACHE_NAMES = {
	images: 'freespeech-images-v1',
	api: 'freespeech-api-v1',
	static: 'freespeech-static-v1',
};

// Image expiry: 30 days
const IMAGE_EXPIRY_DAYS = 30;

// API cache expiry: 1 day
const API_EXPIRY_DAYS = 1;

// Handle navigation requests - Network First with timeout
const navigationHandler = new NetworkFirst({
	cacheName: CACHE_NAMES.static,
	networkTimeoutSeconds: 3,
	plugins: [
		new CacheableResponsePlugin({
			statuses: [0, 200],
		}),
	],
});

registerRoute(
	new NavigationRoute(navigationHandler, {
		// Don't cache auth pages
		denylist: [/\/login/, /\/register/, /\/oauth/],
	}),
);

// Cache media.freespeechaac.com images - Cache First with long expiry
registerRoute(
	({ url }) => url.hostname === 'media.freespeechaac.com',
	new CacheFirst({
		cacheName: CACHE_NAMES.images,
		plugins: [
			new CacheableResponsePlugin({
				statuses: [0, 200],
			}),
			new ExpirationPlugin({
				maxEntries: 500,
				maxAgeSeconds: IMAGE_EXPIRY_DAYS * 24 * 60 * 60,
				purgeOnQuotaError: true,
			}),
		],
	}),
);

// Cache CDN images (for optimized Cloudflare images) - Cache First
registerRoute(
	({ url }) => url.hostname.endsWith('freespeechaac.com') && url.pathname.startsWith('/cdn-cgi/image'),
	new CacheFirst({
		cacheName: CACHE_NAMES.images,
		plugins: [
			new CacheableResponsePlugin({
				statuses: [0, 200],
			}),
			new ExpirationPlugin({
				maxEntries: 500,
				maxAgeSeconds: IMAGE_EXPIRY_DAYS * 24 * 60 * 60,
				purgeOnQuotaError: true,
			}),
		],
	}),
);

// Cache external symbol images (Open Symbols, etc.) - Cache First
registerRoute(
	({ url }) =>
		url.hostname.includes('opensymbols') || url.hostname.includes('arasaac') || url.hostname.includes('mulberry'),
	new CacheFirst({
		cacheName: CACHE_NAMES.images,
		plugins: [
			new CacheableResponsePlugin({
				statuses: [0, 200],
			}),
			new ExpirationPlugin({
				maxEntries: 200,
				maxAgeSeconds: IMAGE_EXPIRY_DAYS * 24 * 60 * 60,
				purgeOnQuotaError: true,
			}),
		],
	}),
);

// Cache API responses - Stale While Revalidate
// This complements the IndexedDB caching for API responses.
// The host is derived from VITE_API_URL rather than hard-coded: a literal
// 'api.freespeechaac.com' check never matched api-v2.freespeechaac.com, so this route
// silently did nothing on every deployment except production.
registerRoute(
	({ url }) => url.origin === API_ORIGIN || url.pathname.startsWith('/api/'),
	new StaleWhileRevalidate({
		cacheName: CACHE_NAMES.api,
		plugins: [
			new CacheableResponsePlugin({
				statuses: [0, 200],
			}),
			new ExpirationPlugin({
				maxEntries: 100,
				maxAgeSeconds: API_EXPIRY_DAYS * 24 * 60 * 60,
				purgeOnQuotaError: true,
			}),
		],
	}),
);

// Cache Google Fonts - Cache First
registerRoute(
	({ url }) => url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com',
	new CacheFirst({
		cacheName: CACHE_NAMES.static,
		plugins: [
			new CacheableResponsePlugin({
				statuses: [0, 200],
			}),
			new ExpirationPlugin({
				maxEntries: 30,
				maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
			}),
		],
	}),
);

// Bootstrap Icons used to be fetched from cdn.jsdelivr.net and cached at runtime, which meant
// the very first offline launch had no icons at all. The font is now bundled and precached
// with the app shell, so no runtime route is needed.

// Skip waiting and claim clients immediately
self.addEventListener('message', (event) => {
	if (event.data && event.data.type === 'SKIP_WAITING') {
		self.skipWaiting();
	}
});

self.addEventListener('activate', (event) => {
	event.waitUntil(self.clients.claim());
});

// --- Background Sync: sync dirty blobs when connectivity returns ---
const DB_NAME = 'freespeech-cache';
const DB_VERSION = 4;

function openIDB(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

async function syncDirtyBlobs() {
	const db = await openIDB();

	// Read auth token from meta store
	const token: string | null = await new Promise((resolve) => {
		const tx = db.transaction('meta', 'readonly');
		const req = tx.objectStore('meta').get('authToken');
		req.onsuccess = () => resolve(req.result?.value ?? null);
		req.onerror = () => resolve(null);
	});

	if (!token) {
		db.close();
		return;
	}

	// Get all dirty blobs
	const dirtyBlobs: Array<{ id: string; blob: any; lastEditedAt: string }> = await new Promise((resolve) => {
		const tx = db.transaction('projectBlobs', 'readonly');
		const store = tx.objectStore('projectBlobs');
		const req = store.getAll();
		req.onsuccess = () => {
			const all = req.result || [];
			resolve(
				all
					.filter((e: any) => e.dirty)
					.map((e: any) => ({ id: e.id, blob: e.blob, lastEditedAt: e.blob.lastEditedAt })),
			);
		};
		req.onerror = () => resolve([]);
	});

	for (const entry of dirtyBlobs) {
		const res = await fetch(`${API_BASE_URL}/project/${entry.id}/sync`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify({ blob: entry.blob, lastEditedAt: entry.lastEditedAt, force: true }),
		});

		if (res.ok) {
			const data = await res.json();
			// Mark blob as clean in IndexedDB
			await new Promise<void>((resolve, reject) => {
				const tx = db.transaction('projectBlobs', 'readwrite');
				const store = tx.objectStore('projectBlobs');
				const getReq = store.get(entry.id);
				getReq.onsuccess = () => {
					const record = getReq.result;
					if (record) {
						record.dirty = false;
						if (data.lastEditedAt) {
							record.blob.lastEditedAt = data.lastEditedAt;
						}
						store.put(record);
					}
					tx.oncomplete = () => resolve();
					tx.onerror = () => reject(tx.error);
				};
				getReq.onerror = () => reject(getReq.error);
			});
		} else {
			// Non-OK response — throw so sync manager can retry
			throw new Error(`Sync failed for ${entry.id}: ${res.status}`);
		}
	}

	db.close();
}

self.addEventListener('sync', (event: any) => {
	if (event.tag === 'sync-dirty-blobs') {
		event.waitUntil(syncDirtyBlobs());
	}
});
