import { createSignal, Show } from 'solid-js';
import { discardEditMode, saveEditMode } from '@/lib/blob-sync';
import { pendingAction, setPendingEditModeAction } from '@/lib/edit-mode-action';
import {
	setActiveModalId,
	setEditingTilePositions,
	setEditingTiles,
	setMultiSelectMode,
	setUsingOnlineSearch,
} from '@/lib/state';

function exitEditMode() {
	setEditingTiles(false);
	setEditingTilePositions([]);
	setMultiSelectMode(false);
	setUsingOnlineSearch(false);
}

export default function SaveEditMode() {
	const [saving, setSaving] = createSignal(false);
	const [saveFailed, setSaveFailed] = createSignal(false);

	const handleSave = async () => {
		setSaving(true);
		setSaveFailed(false);
		try {
			await saveEditMode();
			exitEditMode();
			setActiveModalId('');
			const action = pendingAction;
			setPendingEditModeAction(null);
			await action?.();
		} catch {
			setSaveFailed(true);
		} finally {
			setSaving(false);
		}
	};

	const handleDiscard = async () => {
		if (saving()) return;
		try {
			await discardEditMode();
		} catch {
			setSaveFailed(true);
			return;
		}
		exitEditMode();
		setActiveModalId('');
		const action = pendingAction;
		setPendingEditModeAction(null);
		await action?.();
	};

	const handleCancel = () => {
		if (saving()) return;
		setActiveModalId('');
		setPendingEditModeAction(null);
	};

	return (
		<div class="flex flex-col gap-3">
			<p class="text-sm text-zinc-300">You have unsaved changes. What would you like to do?</p>
			<Show when={saveFailed()}>
				<p class="text-sm text-red-400">Your changes could not be saved on this device. Please try again.</p>
			</Show>

			<button
				type="button"
				onClick={handleSave}
				disabled={saving()}
				class="flex items-center justify-center gap-2 rounded-md border border-blue-500 bg-blue-600 p-2 text-white transition-colors hover:bg-blue-500 disabled:opacity-60"
			>
				<i aria-hidden="true" class={saving() ? 'bi bi-arrow-repeat animate-spin' : 'bi bi-check-lg'} />
				<span>{saving() ? 'Saving…' : 'Save Changes'}</span>
			</button>

			<button
				type="button"
				onClick={handleDiscard}
				disabled={saving()}
				class="flex items-center justify-center gap-2 rounded-md border border-red-500 bg-red-600 p-2 text-white transition-colors hover:bg-red-500 disabled:opacity-60"
			>
				<i aria-hidden="true" class="bi bi-trash" />
				<span>Discard Changes</span>
			</button>

			<button
				type="button"
				onClick={handleCancel}
				disabled={saving()}
				class="flex items-center justify-center gap-2 rounded-md border border-zinc-600 bg-zinc-700 p-2 text-zinc-200 transition-colors hover:bg-zinc-600 disabled:opacity-60"
			>
				<span>Cancel</span>
			</button>
		</div>
	);
}
