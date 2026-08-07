import { createSignal } from 'solid-js';
import { Workbox } from 'workbox-window';
import { currentPageId, projectBlob, sentence, setSentence } from '@/lib/state';
import type { ProjectBlob, Tile } from '@/lib/types';
import { apiVersionMismatch } from '@/lib/version-check';

export const [swNeedsUpdate, setSwNeedsUpdate] = createSignal(false);
export const [swUpdateChecking, setSwUpdateChecking] = createSignal(false);
// Set when a client that knows it is stale keeps completing update checks without a new worker
// taking control. The banner degrades from "Check Again" to a plain reload at that point — a
// stale page under an already-updated worker can never progress any other way, and for every
// other stuck state the reload re-runs registration, which is the next-best recovery.
export const [swUpdateStalled, setSwUpdateStalled] = createSignal(false);

let workbox: Workbox | null = null;
let registrationPromise: Promise<ServiceWorkerRegistration | undefined> | null = null;
let updateCheckPromise: Promise<void> | null = null;
let checkRequestedBeforeRegistration = false;
let futileUpdateChecks = 0;

// One empty check proves little (it may race a deploy or an install still in flight), so two
// must complete before the banner stops promising automatic progress.
const STALL_AFTER_FUTILE_CHECKS = 2;
// update() resolves when the sw.js fetch completes, not when a found worker has installed and
// taken control — judging a check futile waits this long for a real takeover to land first.
const CHECK_SETTLE_MS = 4000;

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

	// The worker calls skipWaiting() on install, so an update normally takes control of open pages
	// as soon as it lands, and this event is how the banner learns that happened. `isUpdate` alone
	// is not the right test: workbox sets it from whether the page was controlled at registration
	// time, so a takeover after an uncontrolled load (hard reload, a registration iOS evicted)
	// arrives flagged `isExternal` instead — ignoring those left the banner spinning forever under
	// a worker that had already updated. A first-time install sets neither flag and stays silent.
	workbox.addEventListener('controlling', (event) => {
		if (event.isUpdate || event.isExternal) {
			resetSwUpdateStall();
			setSwUpdateChecking(false);
			setSwNeedsUpdate(true);
		}
	});

	// skipWaiting() during install is exactly the handoff iOS drops sometimes. A worker parked in
	// "waiting" makes every later update check a byte-identical no-op — permanently, since nothing
	// else ever promotes it while pages stay open — so kick it with the SKIP_WAITING message the
	// worker still handles. workbox also fires this at register() time for a worker left waiting
	// by a previous session, which is what recovers an already-stuck device on its next launch.
	workbox.addEventListener('waiting', () => {
		workbox?.messageSkipWaiting();
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

/** Clears stall tracking so the next mismatch episode judges its own checks fresh. */
export function resetSwUpdateStall() {
	futileUpdateChecks = 0;
	setSwUpdateStalled(false);
}

/** Checks for a worker update now, coalescing visibility/API/interval triggers into one request. */
export function requestServiceWorkerUpdate(): Promise<void> {
	if (!workbox || !registrationPromise) {
		checkRequestedBeforeRegistration = true;
		return Promise.resolve();
	}
	// No navigator.onLine gate here: installed iOS PWAs sometimes report it false while the
	// network works, which silently disabled every check. A genuinely offline update() just
	// rejects into the catch below.
	if (swNeedsUpdate()) return Promise.resolve();
	if (updateCheckPromise) return updateCheckPromise;

	setSwUpdateChecking(true);
	const wb = workbox;
	updateCheckPromise = registrationPromise
		.then(async (registration) => {
			if (!registration) return;
			await wb.update();
			await new Promise((resolve) => setTimeout(resolve, CHECK_SETTLE_MS));
			if (!swNeedsUpdate() && apiVersionMismatch()) {
				futileUpdateChecks += 1;
				if (futileUpdateChecks >= STALL_AFTER_FUTILE_CHECKS) setSwUpdateStalled(true);
			}
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
