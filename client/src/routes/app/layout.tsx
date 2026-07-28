import type { RouteSectionProps } from '@solidjs/router';
import { type Component, createEffect, createSignal, Show } from 'solid-js';
import InstallPrompt from '@/components/InstallPrompt';
import Modal from '@/components/Modal';
import OfflineBanner from '@/components/OfflineBanner';
import UpdateBanner from '@/components/UpdateBanner';
import { accessControlSettingsLoaded, sessionStatus, user } from '@/lib/state';
import BottomNavigation from '@/routes/app/_components/BottomNavigation';

const Layout: Component<RouteSectionProps<unknown>> = (props) => {
	const [show, setShow] = createSignal(false);

	createEffect(() => {
		// A cached token is enough to enter the offline shell. The user profile may not have been
		// cached yet on an upgraded installation, but the board blobs are still independently usable.
		if (accessControlSettingsLoaded() && (user() || sessionStatus() === 'offline')) setShow(true);
	});

	return (
		<Show
			when={show()}
			fallback={
				<div class="fixed inset-0 flex flex-col items-center justify-center gap-10 bg-zinc-900">
					<img src="/logo.png" alt="FreeSpeech AAC" class="h-24 w-24 animate-splash-breathe" draggable={false} />
					<div class="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-400" />
				</div>
			}
		>
			<UpdateBanner />
			<OfflineBanner />
			<main
				class="fixed inset-0 flex overflow-hidden flex-col bg-zinc-900"
				style={{ 'padding-top': 'env(safe-area-inset-top, 0px)' }}
			>
				<div class="relative min-h-0 flex-1 overflow-hidden">
					<div class="absolute inset-0 flex min-h-0 w-full flex-col overflow-hidden">{props.children}</div>
				</div>
				<BottomNavigation />
			</main>
			<Modal />
			<InstallPrompt />
		</Show>
	);
};

export default Layout;
