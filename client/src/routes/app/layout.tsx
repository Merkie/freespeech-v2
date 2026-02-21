import { type RouteSectionProps, useLocation, useNavigate } from '@solidjs/router';
import { type Component, createEffect, createSignal, Show } from 'solid-js';
import InstallPrompt from '@/components/InstallPrompt';
import Modal from '@/components/Modal';
import OfflineBanner from '@/components/OfflineBanner';
import { localSettings, user } from '@/lib/state';
import BottomNavigation from '@/routes/app/_components/BottomNavigation';

const Layout: Component<RouteSectionProps<unknown>> = (props) => {
	const [show, setShow] = createSignal(false);
	const [hasRedirected, setHasRedirected] = createSignal(false);
	const location = useLocation();
	const navigate = useNavigate();

	createEffect(() => {
		if (user()) setShow(true);
	});

	// Redirect to last visited project when user is authenticated and on dashboard
	createEffect(() => {
		const currentUser = user();
		const lastProjectId = localSettings().lastVisitedProjectId;

		// Only redirect once, when user is authenticated
		if (!currentUser || hasRedirected()) return;

		// Only redirect if we're at /app/dashboard/projects
		// Note: /app is now handled by AppEntryPage
		const isDashboardProjects =
			location.pathname === '/app/dashboard/projects' || location.pathname === '/app/dashboard/projects/';

		if (isDashboardProjects && lastProjectId) {
			setHasRedirected(true);
			navigate(`/app/project/${lastProjectId}`, { replace: true });
		}
	});

	return (
		<Show when={show()} fallback={<div>One moment...</div>}>
			<OfflineBanner />
			<main class="flex h-[100dvh] flex-col">
				<div class="relative flex-1 overflow-auto">
					<div class="absolute top-0 left-0 flex max-h-full min-h-full w-full flex-col">{props.children}</div>
				</div>
				<BottomNavigation />
			</main>
			<Modal />
			<InstallPrompt />
		</Show>
	);
};

export default Layout;
