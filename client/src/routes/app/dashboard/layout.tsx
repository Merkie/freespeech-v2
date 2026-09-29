import { A, type RouteSectionProps } from '@solidjs/router';
import { type Component, onCleanup, Show } from 'solid-js';
import { MODAL_ID } from '@/lib/constants';
import { pinLockActive } from '@/lib/pin';
import {
	accessControlSettingsLoaded,
	dashboardUnlocked,
	requestPinUnlock,
	setActiveModalId,
	setDashboardUnlocked,
} from '@/lib/state';
import DashboardContent from './_components/DashboardContent';
import DashboardHeader from './_components/DashboardHeader';

const DashboardLayout: Component<RouteSectionProps<unknown>> = (props) => {
	onCleanup(() => setDashboardUnlocked(false));
	const unlock = () => {
		requestPinUnlock('Enter your passcode to open the dashboard.', () => setDashboardUnlocked(true));
		setActiveModalId(MODAL_ID.PIN_ENTRY);
	};
	return (
		<Show
			when={accessControlSettingsLoaded() && (!pinLockActive() || dashboardUnlocked())}
			fallback={
				<div class="m-auto flex max-w-sm flex-col gap-4 p-6 text-center text-white">
					<p>
						{accessControlSettingsLoaded()
							? 'The dashboard is locked.'
							: 'Connect to load your account’s editing controls. Your saved board is still available.'}
					</p>
					<Show when={accessControlSettingsLoaded()}>
						<button type="button" class="rounded bg-blue-600 p-3" onClick={unlock}>
							Unlock dashboard
						</button>
					</Show>
					<A href="/app" class="underline">
						Return to board
					</A>
				</div>
			}
		>
			<DashboardHeader />
			<DashboardContent>{props.children}</DashboardContent>
		</Show>
	);
};
export default DashboardLayout;
