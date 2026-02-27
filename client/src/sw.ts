/// <reference lib="webworker" />

import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';

declare let self: ServiceWorkerGlobalScope;

// Precache all static assets
precacheAndRoute(self.__WB_MANIFEST);

// Clean up old caches
cleanupOutdatedCaches();

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
// This complements the IndexedDB caching for API responses
registerRoute(
	({ url }) => url.hostname.includes('api.freespeechaac.com') || url.pathname.startsWith('/api/'),
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

// Cache Bootstrap Icons CSS - Cache First
registerRoute(
	({ url }) => url.hostname === 'cdn.jsdelivr.net' && url.pathname.includes('bootstrap-icons'),
	new CacheFirst({
		cacheName: CACHE_NAMES.static,
		plugins: [
			new CacheableResponsePlugin({
				statuses: [0, 200],
			}),
			new ExpirationPlugin({
				maxEntries: 10,
				maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
			}),
		],
	}),
);

// Skip waiting and claim clients immediately
self.addEventListener('message', (event) => {
	if (event.data && event.data.type === 'SKIP_WAITING') {
		self.skipWaiting();
	}
});

self.addEventListener('activate', (event) => {
	event.waitUntil(self.clients.claim());
});
