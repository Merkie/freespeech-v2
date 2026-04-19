import type { RouteSectionProps } from '@solidjs/router';
import { type Component, createEffect, createSignal, Show } from 'solid-js';
import InstallPrompt from '@/components/InstallPrompt';
import Modal from '@/components/Modal';
import OfflineBanner from '@/components/OfflineBanner';
import ToastContainer from '@/components/ToastContainer';
import UpdateBanner from '@/components/UpdateBanner';
import { user } from '@/lib/state';
import BottomNavigation from '@/routes/app/_components/BottomNavigation';

const Layout: Component<RouteSectionProps<unknown>> = (props) => {
	const [show, setShow] = createSignal(false);

	createEffect(() => {
		if (user()) setShow(true);
	});

	return (
		<Show when={show()} fallback={<div>One moment...</div>}>
			<UpdateBanner />
			<OfflineBanner />
			<main class="flex h-[100dvh] flex-col">
				<div class="relative flex-1 overflow-auto">
					<div class="absolute top-0 left-0 flex max-h-full min-h-full w-full flex-col">{props.children}</div>
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
