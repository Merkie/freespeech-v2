import { createSignal, Show } from 'solid-js';
import { setPendingEditModeAction } from '@/components/Modal/_modal_inners/SaveEditMode';
import { hasUnsavedEditChanges, prepareForAppReload } from '@/lib/blob-sync';
import { MODAL_ID } from '@/lib/constants';
import { setActiveModalId } from '@/lib/state';
import { applySwUpdate, requestServiceWorkerUpdate, swNeedsUpdate, swUpdateChecking } from '@/lib/sw-update';
import { apiVersionMismatch } from '@/lib/version-check';

export default function UpdateBanner() {
	const [applying, setApplying] = createSignal(false);
	const [saveFailed, setSaveFailed] = createSignal(false);
	const shouldShow = () => swNeedsUpdate() || apiVersionMismatch();

	const finishUpdate = async () => {
		setApplying(true);
		setSaveFailed(false);
		try {
			if (!(await prepareForAppReload())) {
				setApplying(false);
				return;
			}
			applySwUpdate();
		} catch {
			setSaveFailed(true);
			setApplying(false);
		}
	};

	const handleUpdate = () => {
		if (!swNeedsUpdate()) {
			void requestServiceWorkerUpdate();
			return;
		}

		if (hasUnsavedEditChanges()) {
			setPendingEditModeAction(finishUpdate);
			setActiveModalId(MODAL_ID.SAVE_EDIT_MODE);
			return;
		}

		void finishUpdate();
	};

	const message = () => {
		if (saveFailed()) return 'Your board could not be saved on this device. Please try again.';
		if (swNeedsUpdate()) return 'An update is ready. Reload to use the latest version.';
		return 'A new version is available. Preparing it now…';
	};

	const buttonLabel = () => {
		if (applying()) return 'Saving…';
		if (swNeedsUpdate()) return hasUnsavedEditChanges() ? 'Save and Update' : 'Update Now';
		return swUpdateChecking() ? 'Checking…' : 'Check Again';
	};

	return (
		<Show when={shouldShow()}>
			<div
				aria-live="polite"
				class="flex w-full items-center justify-between gap-3 bg-blue-600 px-4 py-2 text-sm font-medium text-white"
			>
				<div class="flex items-center gap-2">
					<i aria-hidden="true" class={swNeedsUpdate() ? 'bi bi-arrow-up-circle' : 'bi bi-arrow-repeat animate-spin'} />
					<span>{message()}</span>
				</div>
				<button
					type="button"
					onClick={handleUpdate}
					disabled={applying() || (!swNeedsUpdate() && swUpdateChecking())}
					class="shrink-0 rounded-md bg-white/20 px-3 py-1 text-sm font-medium transition-colors hover:bg-white/30 disabled:opacity-60"
				>
					{buttonLabel()}
				</button>
			</div>
		</Show>
	);
}
