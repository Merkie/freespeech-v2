import { type RouteSectionProps, useLocation, useNavigate } from '@solidjs/router';
import { type Component, onMount } from 'solid-js';
import api from '@/lib/api';
import { cacheAuthToken, cacheAuthUser, clearCachedAuth, getCachedAuthUser } from '@/lib/cache/meta-cache';
import { setSessionStatus, setUser } from '@/lib/state';

// Check if running as installed PWA (standalone mode)
function isStandalone(): boolean {
	return (
		window.matchMedia('(display-mode: standalone)').matches ||
		(window.navigator as Navigator & { standalone?: boolean }).standalone === true
	);
}

const Layout: Component<RouteSectionProps<unknown>> = (props) => {
	const location = useLocation();
	const navigate = useNavigate();

	onMount(async () => {
		const token = localStorage.getItem('token');

		// PWA standalone mode: never show landing page. /app works out which board to open, so
		// that decision lives in one place rather than being repeated here. Keep checking the
		// session after navigating: returning here left the app shell waiting forever for user().
		if (isStandalone() && location.pathname === '/') {
			navigate(token ? '/app' : '/login', { replace: true });
			if (!token) {
				setSessionStatus('unauthenticated');
				return;
			}
		}

		if (!token) {
			setSessionStatus('unauthenticated');
			return handleAppRedirect();
		}

		try {
			const data = await api.auth.me(token);

			if (data.user) {
				setUser(data.user);
				setSessionStatus('authenticated');
				await Promise.all([cacheAuthToken(token), cacheAuthUser(data.user)]).catch(() => undefined);
			} else if ([401, 403, 404].includes(data.status)) {
				// Only a definitive server rejection signs the device out. A timeout, offline launch,
				// or temporary 5xx must never destroy a session that still has usable cached boards.
				localStorage.removeItem('token');
				await clearCachedAuth().catch(() => undefined);
				setUser(null);
				setSessionStatus('unauthenticated');
				handleAppRedirect();
			} else {
				throw new Error(data.error || `Session check failed with status ${data.status}`);
			}
		} catch {
			// Offline access is possession-based on this unlocked device: the saved token proves a
			// prior login, and the cached profile only supplies shell/header display fields. Server
			// validation resumes automatically on the next cold start with connectivity.
			setSessionStatus('offline');
			const cachedUser = await getCachedAuthUser();
			if (cachedUser) setUser(cachedUser);
		}
	});

	function handleAppRedirect() {
		if (location.pathname.startsWith('/app')) {
			navigate('/login', { replace: true });
		}
	}

	return props.children;
};

export default Layout;
