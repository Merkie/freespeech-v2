import { Show } from 'solid-js';
import { globalIsOnline } from '@/hooks/useNetworkStatus';

export default function OfflineSettingsNotice() {
	return (
		<Show when={!globalIsOnline()}>
			<output class="flex max-w-4xl items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900">
				<i class="bi bi-wifi-off mt-0.5 text-xl" />
				<span class="text-lg">
					You’re offline. Device settings can still be changed, but account-backed settings may be refreshed from your
					account when you reconnect.
				</span>
			</output>
		</Show>
	);
}
