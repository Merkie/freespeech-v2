import { createSignal } from 'solid-js';
import { Workbox } from 'workbox-window';

export const [swNeedsUpdate, setSwNeedsUpdate] = createSignal(false);

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
	if (!('serviceWorker' in navigator)) return;

	const wb = new Workbox('/sw.js');

	// The worker calls skipWaiting() on install, so an update never parks in "waiting" — it takes
	// control of open pages as soon as it lands. The old flow (show a banner at "waiting", have the
	// button post SKIP_WAITING and reload on "controlling") depended on exactly the handoff iOS is
	// flaky about, which is how the banner's button could visibly do nothing. Now the banner only
	// appears once the new worker is already in control, and the button is a plain reload — the one
	// step that cannot fail.
	wb.addEventListener('controlling', (event) => {
		if (event.isUpdate) setSwNeedsUpdate(true);
	});

	const registration = wb.register();

	const checkForUpdate = () => {
		// Nothing left to find once the banner is up, and nothing to fetch while offline.
		if (swNeedsUpdate() || !navigator.onLine) return;
		// Best-effort: a failed check (registration not ready yet, transient network error) just
		// means the next one tries again. Surfacing it would only produce noise on a flaky iPad.
		void registration.then(() => wb.update()).catch(() => undefined);
	};

	setInterval(checkForUpdate, UPDATE_POLL_MS);

	// The interval alone is not enough. iOS suspends timers in a backgrounded PWA, so on the device
	// this matters most the clock stops the moment the iPad is put down. Returning to the app is
	// both when timers resume and when someone is about to use it, which makes it the single most
	// useful moment to check.
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'visible') checkForUpdate();
	});

	// A board that was offline across a deploy has no idea it missed one.
	window.addEventListener('online', checkForUpdate);
}

export function applySwUpdate() {
	window.location.reload();
}
