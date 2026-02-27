import { Show } from 'solid-js';
import { applySwUpdate, swNeedsUpdate } from '@/lib/sw-update';
import { apiVersionMismatch } from '@/lib/version-check';

export default function UpdateBanner() {
	const shouldShow = () => swNeedsUpdate() || apiVersionMismatch();

	const handleUpdate = () => {
		if (swNeedsUpdate()) {
			applySwUpdate();
		} else {
			window.location.reload();
		}
	};

	return (
		<Show when={shouldShow()}>
			<div class="fixed top-0 left-0 right-0 z-50 flex items-center justify-between bg-blue-600 px-4 py-2 text-sm font-medium text-white">
				<div class="flex items-center gap-2">
					<i class="bi bi-arrow-up-circle" />
					<span>A new version of FreeSpeech is available</span>
				</div>
				<button
					onClick={handleUpdate}
					class="rounded-md bg-white/20 px-3 py-1 text-sm font-medium transition-colors hover:bg-white/30"
				>
					Update Now
				</button>
			</div>
		</Show>
	);
}
