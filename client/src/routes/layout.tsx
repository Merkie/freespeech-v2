import { type RouteSectionProps, useLocation, useNavigate } from '@solidjs/router';
import { type Component, onMount } from 'solid-js';
import api from '@/lib/api';
import { setUser } from '@/lib/state';

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
		// that decision lives in one place rather than being repeated here.
		if (isStandalone() && location.pathname === '/') {
			navigate(token ? '/app' : '/login', { replace: true });
			return;
		}

		if (!token) return handleAppRedirect();

		try {
			const data = await api.auth.me(token);

			if (data.user) {
				setUser(data.user);
			} else {
				localStorage.removeItem('token');
				handleAppRedirect();
			}
		} catch {
			localStorage.removeItem('token');
			handleAppRedirect();
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
