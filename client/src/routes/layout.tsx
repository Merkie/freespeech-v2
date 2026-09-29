import { type RouteSectionProps, useLocation, useNavigate } from '@solidjs/router';
import { type Component, onCleanup, onMount } from 'solid-js';
import api from '@/lib/api';
import { cacheAuthSession, cachedSessionMatches, getCachedAuthToken, getCachedAuthUser } from '@/lib/cache/meta-cache';
import { hydrateAccessControlSettings, resetAccessControlSettings, restoreAccessControlSettings } from '@/lib/pin';
import { clearDeviceBoards, endSession } from '@/lib/session';
import { setSessionStatus, setUser } from '@/lib/state';

const Layout: Component<RouteSectionProps<unknown>> = (props) => {
	const location = useLocation();
	const navigate = useNavigate();
	let refreshing = false;

	const redirect = () => {
		if (location.pathname.startsWith('/app')) navigate('/login', { replace: true });
	};
	const refreshSession = async () => {
		const token = localStorage.getItem('token');
		if (!token || refreshing) return;
		refreshing = true;
		try {
			const data = await api.auth.me(token);
			if (localStorage.getItem('token') !== token) return;
			if (data.user) {
				const previous = await getCachedAuthUser();
				if (previous && previous.id !== data.user.id) await clearDeviceBoards();
				if (localStorage.getItem('token') !== token) return;
				setUser(data.user);
				setSessionStatus('authenticated');
				void hydrateAccessControlSettings(data.user.id);
				await cacheAuthSession(token, data.user).catch(() => undefined);
			} else if ([401, 403, 404].includes(data.status)) {
				// Retain this account's offline edits for reauthentication; a different login clears them.
				await endSession(false);
				redirect();
			} else setSessionStatus('offline');
		} catch {
			if (localStorage.getItem('token') === token) setSessionStatus('offline');
		} finally {
			refreshing = false;
		}
	};
	window.addEventListener('online', refreshSession);
	onCleanup(() => window.removeEventListener('online', refreshSession));

	onMount(async () => {
		const token = localStorage.getItem('token');
		const standalone =
			window.matchMedia('(display-mode: standalone)').matches ||
			(navigator as Navigator & { standalone?: boolean }).standalone;
		if (standalone && location.pathname === '/') navigate(token ? '/app' : '/login', { replace: true });
		if (!token) {
			resetAccessControlSettings();
			setSessionStatus('unauthenticated');
			redirect();
			return;
		}
		// Device reads only. No auth, PIN, or board request is allowed to delay the saved board.
		const [cached, savedToken] = await Promise.all([getCachedAuthUser(), getCachedAuthToken().catch(() => null)]);
		if (localStorage.getItem('token') !== token) return;
		if (cached && cachedSessionMatches(token, savedToken, cached)) {
			await restoreAccessControlSettings(cached.id);
			setUser(cached);
		} else if (!cached) {
			// Older installations may have a saved board without a cached profile. Communication
			// still works; editing stays disabled until this account's settings are known.
			setSessionStatus('offline');
		}
		void refreshSession();
	});
	return props.children;
};
export default Layout;
