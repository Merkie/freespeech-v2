import { createSignal } from 'solid-js';
import { Workbox } from 'workbox-window';
import { currentPageId, projectBlob, sentence, setSentence } from '@/lib/state';
import type { ProjectBlob, Tile } from '@/lib/types';

export const [swNeedsUpdate, setSwNeedsUpdate] = createSignal(false);
export const [swUpdateChecking, setSwUpdateChecking] = createSignal(false);

let workbox: Workbox | null = null;
let registrationPromise: Promise<ServiceWorkerRegistration | undefined> | null = null;
let updateCheckPromise: Promise<void> | null = null;
let checkRequestedBeforeRegistration = false;

const RELOAD_STATE_KEY = 'freespeech-update-reload-state';

// How often an open app asks whether a newer worker has been deployed.
//
// Left to itself the browser only looks for a new sw.js when the worker is registered — a page
// load — and roughly once a day after that. An installed iPad PWA is effectively never closed and
// rarely reloaded, so without this it can sit on an old build indefinitely while the banner logic
// below works perfectly: it is simply never told there is anything to announce.
//
// A check costs one conditional GET of sw.js, which nginx already serves no-cache, so this is
// cheap enough to run all day and still far above the rate at which deploys happen.
const UPDATE_POLL_MS = 15 * 60 * 1000;

export function registerServiceWorker() {
	if (!('serviceWorker' in navigator) || registrationPromise) return;

	workbox = new Workbox('/sw.js');

	// The worker calls skipWaiting() on install, so an update never parks in "waiting" — it takes
	// control of open pages as soon as it lands. The old flow (show a banner at "waiting", have the
	// button post SKIP_WAITING and reload on "controlling") depended on exactly the handoff iOS is
	// flaky about, which is how the banner's button could visibly do nothing. Now the banner only
	// appears once the new worker is already in control, and the button is a plain reload — the one
	// step that cannot fail.
	workbox.addEventListener('controlling', (event) => {
		if (event.isUpdate) {
			setSwUpdateChecking(false);
			setSwNeedsUpdate(true);
		}
	});

	registrationPromise = workbox.register();
	if (checkRequestedBeforeRegistration) {
		checkRequestedBeforeRegistration = false;
		void requestServiceWorkerUpdate();
	}

	setInterval(() => void requestServiceWorkerUpdate(), UPDATE_POLL_MS);

	// The interval alone is not enough. iOS suspends timers in a backgrounded PWA, so on the device
	// this matters most the clock stops the moment the iPad is put down. Returning to the app is
	// both when timers resume and when someone is about to use it, which makes it the single most
	// useful moment to check.
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'visible') void requestServiceWorkerUpdate();
	});

	// A board that was offline across a deploy has no idea it missed one.
	window.addEventListener('online', () => void requestServiceWorkerUpdate());
}

/** Checks for a worker update now, coalescing visibility/API/interval triggers into one request. */
export function requestServiceWorkerUpdate(): Promise<void> {
	if (!workbox || !registrationPromise) {
		checkRequestedBeforeRegistration = true;
		return Promise.resolve();
	}
	if (swNeedsUpdate() || !navigator.onLine) return Promise.resolve();
	if (updateCheckPromise) return updateCheckPromise;

	setSwUpdateChecking(true);
	const wb = workbox;
	updateCheckPromise = registrationPromise
		.then((registration) => {
			if (registration) return wb.update();
		})
		.catch(() => undefined)
		.finally(() => {
			updateCheckPromise = null;
			if (!swNeedsUpdate()) setSwUpdateChecking(false);
		});

	return updateCheckPromise;
}

export function applySwUpdate() {
	try {
		const blob = projectBlob();
		const pageId = currentPageId();
		if (blob && pageId) {
			sessionStorage.setItem(
				RELOAD_STATE_KEY,
				JSON.stringify({ projectId: blob.id, pageId, sentence: sentence(), savedAt: Date.now() }),
			);
		}
	} catch {
		// Session state is a convenience; a storage failure must never block an update.
	}
	window.location.reload();
}

/** Restores the board-only state that a deliberate update reload would otherwise clear. */
export function consumeSwReloadState(projectId: string, blob: ProjectBlob): string | null {
	try {
		const raw = sessionStorage.getItem(RELOAD_STATE_KEY);
		if (!raw) return null;

		const stored = JSON.parse(raw) as { projectId?: string; pageId?: string; sentence?: Tile[]; savedAt?: number };
		if (stored.projectId !== projectId || !stored.savedAt || Date.now() - stored.savedAt > 60 * 60 * 1000) {
			sessionStorage.removeItem(RELOAD_STATE_KEY);
			return null;
		}
		sessionStorage.removeItem(RELOAD_STATE_KEY);

		if (Array.isArray(stored.sentence)) setSentence(stored.sentence);
		return stored.pageId && blob.pages.some((page) => page.id === stored.pageId) ? stored.pageId : null;
	} catch {
		try {
			sessionStorage.removeItem(RELOAD_STATE_KEY);
		} catch {
			// Storage is optional; returning Home is still a valid recovery path.
		}
		return null;
	}
}
