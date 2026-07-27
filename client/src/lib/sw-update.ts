import { createSignal } from 'solid-js';
import { Workbox } from 'workbox-window';

export const [swNeedsUpdate, setSwNeedsUpdate] = createSignal(false);

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

	wb.register();
}

export function applySwUpdate() {
	window.location.reload();
}
