import { createSignal } from 'solid-js';
import { requestServiceWorkerUpdate } from '@/lib/sw-update';

declare const __APP_VERSION__: string;

export const CLIENT_VERSION = __APP_VERSION__;

export const [apiVersionMismatch, setApiVersionMismatch] = createSignal(false);

export function checkVersionHeader(response: Response) {
	const serverVersion = response.headers.get('x-app-version');
	if (!serverVersion) return;

	if (serverVersion !== CLIENT_VERSION) {
		setApiVersionMismatch(true);
		void requestServiceWorkerUpdate();
	} else if (apiVersionMismatch()) {
		// Avoid a sticky false alarm during the few seconds in which a deploy changes the static
		// client and restarts the API. A genuine stale client keeps seeing the mismatch.
		setApiVersionMismatch(false);
	}
}
