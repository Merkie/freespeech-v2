import { createSignal } from 'solid-js';

export type ToastType = 'info' | 'success' | 'error';

export interface Toast {
	id: number;
	message: string;
	type: ToastType;
}

let nextId = 0;
const AUTO_DISMISS_MS = 4000;

export const [toasts, setToasts] = createSignal<Toast[]>([]);

export function showToast(message: string, type: ToastType = 'info') {
	const id = nextId++;
	setToasts((prev) => [...prev, { id, message, type }]);

	setTimeout(() => {
		setToasts((prev) => prev.filter((t) => t.id !== id));
	}, AUTO_DISMISS_MS);
}
