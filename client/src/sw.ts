/// <reference lib="webworker" />

import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { handleApi, handleImage } from '@/lib/sw-cache';

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

cleanupOutdatedCaches();

// The API this build talks to. Deployments differ (api.freespeechaac.com in production,
// api-v2.freespeechaac.com for the v2 preview), so routes match on it instead of a literal.
const API_BASE_URL = import.meta.env.VITE_API_URL as string;
const API_ORIGIN = new URL(API_BASE_URL).origin;

const IMAGE_CACHE = 'freespeech-images-v2';
const API_CACHE = 'freespeech-api-v2';

// Caches written by earlier versions of this worker. An installed PWA keeps them forever
// otherwise, and the v1 image cache in particular is full of entries that should never have been
// stored (see the note on best-effort caching below).
const RETIRED_CACHES = ['freespeech-images-v1', 'freespeech-api-v1', 'freespeech-static-v1'];

// Deliberately modest. iOS hands an installed PWA a small Cache Storage quota and pads every
// opaque cross-origin response heavily against it, so "500 images" is not a limit that can
// actually be reached on an iPad — it is just a number that gets hit as a quota error instead.
const MAX_IMAGE_ENTRIES = 200;
const MAX_API_ENTRIES = 50;

// Hosts the boards pull tile art from. `request.destination` covers these already on any current
// browser; the list is the fallback for older WebKit, which leaves destination empty.
const IMAGE_HOSTS = ['media.freespeechaac.com', 's3.amazonaws.com', 'coughdrop-usercontent.s3.amazonaws.com'];

// Every cache write below is best-effort — see lib/sw-cache.ts for why that is the whole point of
// this worker rather than defensive padding.

function isImageRequest({ request, url }: { request: Request; url: URL }): boolean {
	if (request.destination === 'image') return true;
	// The media host serves extension-less keys, so there is nothing in the path to match on.
	return IMAGE_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
}

registerRoute(isImageRequest, ({ request, event }) => handleImage(request, IMAGE_CACHE, MAX_IMAGE_ENTRIES, event));

registerRoute(
	({ url }) => url.origin === API_ORIGIN,
	({ request, event }) => handleApi(request, API_CACHE, MAX_API_ENTRIES, event),
);

// --- Navigation ------------------------------------------------------------------------------
//
// Every route is the same SPA shell, so serve the precached index.html rather than going to the
// network for HTML that is identical each time. This is also what makes a cold offline launch
// work: the previous handler only had a shell to fall back on if some earlier navigation had
// happened to be cached.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')));

// --- Lifecycle -------------------------------------------------------------------------------

self.addEventListener('install', () => {
	// An installed iOS PWA is almost never fully closed, so a worker that waits for every client
	// to go away is a worker that never activates. A device could sit on a broken version
	// indefinitely; taking over immediately is the lesser problem.
	void self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			await Promise.all(RETIRED_CACHES.map((name) => caches.delete(name)));
			await self.clients.claim();
		})(),
	);
});

self.addEventListener('message', (event) => {
	if (!event.data) return;
	if (event.data.type === 'SKIP_WAITING') {
		void self.skipWaiting();
	}
	// Sent on sign-out. Cached API responses are keyed by URL alone, so without this the next
	// account signed in on the same device could be served the previous one's data while offline.
	if (event.data.type === 'CLEAR_API_CACHE') {
		event.waitUntil(caches.delete(API_CACHE));
	}
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
