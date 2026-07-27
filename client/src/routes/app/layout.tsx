import type { RouteSectionProps } from '@solidjs/router';
import { type Component, createEffect, createSignal, Show } from 'solid-js';
import InstallPrompt from '@/components/InstallPrompt';
import Modal from '@/components/Modal';
import OfflineBanner from '@/components/OfflineBanner';
import ToastContainer from '@/components/ToastContainer';
import UpdateBanner from '@/components/UpdateBanner';
import { sessionStatus, user } from '@/lib/state';
import BottomNavigation from '@/routes/app/_components/BottomNavigation';

const Layout: Component<RouteSectionProps<unknown>> = (props) => {
	const [show, setShow] = createSignal(false);

	createEffect(() => {
		// A cached token is enough to enter the offline shell. The user profile may not have been
		// cached yet on an upgraded installation, but the board blobs are still independently usable.
		if (user() || sessionStatus() === 'offline') setShow(true);
	});

	return (
		<Show when={show()} fallback={<div>One moment...</div>}>
			<UpdateBanner />
			<OfflineBanner />
			<main class="fixed inset-0 flex overflow-hidden flex-col">
				<div class="relative min-h-0 flex-1 overflow-hidden">
					<div class="absolute inset-0 flex min-h-0 w-full flex-col overflow-hidden">{props.children}</div>
				</div>
				<BottomNavigation />
			</main>
			<Modal />
			<InstallPrompt />
			<ToastContainer />
		</Show>
	);
};

export default Layout;
