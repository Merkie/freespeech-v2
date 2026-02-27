import { createSignal } from 'solid-js';

declare const __APP_VERSION__: string;

export const CLIENT_VERSION = __APP_VERSION__;

export const [apiVersionMismatch, setApiVersionMismatch] = createSignal(false);

export function checkVersionHeader(response: Response) {
	const serverVersion = response.headers.get('x-app-version');
	if (serverVersion && serverVersion !== CLIENT_VERSION) {
		setApiVersionMismatch(true);
	}
}
