import { createSignal, onCleanup, onMount } from 'solid-js';

export interface NetworkStatus {
	isOnline: boolean;
	wasOffline: boolean;
}

/**
 * Hook to track network connectivity status
 *
 * Returns:
 * - isOnline: Current online status
 * - wasOffline: True if the user was offline at some point during this session
 */
export function useNetworkStatus() {
	const [isOnline, setIsOnline] = createSignal(typeof navigator !== 'undefined' ? navigator.onLine : true);
	const [wasOffline, setWasOffline] = createSignal(false);

	onMount(() => {
		const handleOnline = () => {
			setIsOnline(true);
		};

		const handleOffline = () => {
			setIsOnline(false);
			setWasOffline(true);
		};

		window.addEventListener('online', handleOnline);
		window.addEventListener('offline', handleOffline);

		// Check initial state
		if (!navigator.onLine) {
			setWasOffline(true);
		}

		onCleanup(() => {
			window.removeEventListener('online', handleOnline);
			window.removeEventListener('offline', handleOffline);
		});
	});

	return {
		isOnline,
		wasOffline,
	};
}

// Create a global network status signal for use across the app
const [globalIsOnline, setGlobalIsOnline] = createSignal(typeof navigator !== 'undefined' ? navigator.onLine : true);

if (typeof window !== 'undefined') {
	window.addEventListener('online', () => setGlobalIsOnline(true));
	window.addEventListener('offline', () => setGlobalIsOnline(false));
}

export { globalIsOnline };
