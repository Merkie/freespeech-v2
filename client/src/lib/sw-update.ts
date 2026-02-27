import { createSignal } from 'solid-js';
import { Workbox } from 'workbox-window';

export const [swNeedsUpdate, setSwNeedsUpdate] = createSignal(false);

let wb: Workbox | null = null;

export function registerServiceWorker() {
	if (!('serviceWorker' in navigator)) return;

	wb = new Workbox('/sw.js');

	wb.addEventListener('waiting', () => {
		setSwNeedsUpdate(true);
	});

	wb.register();
}

export function applySwUpdate() {
	if (!wb) {
		window.location.reload();
		return;
	}

	wb.addEventListener('controlling', () => {
		window.location.reload();
	});

	wb.messageSkipWaiting();
}
