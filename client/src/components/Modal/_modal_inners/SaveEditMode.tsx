import { discardEditMode, saveEditMode } from '@/lib/blob-sync';
import {
	setActiveModalId,
	setEditingTilePositions,
	setEditingTiles,
	setMultiSelectMode,
	setUsingOnlineSearch,
} from '@/lib/state';

// Pending action to execute after save/discard (e.g., navigate home)
let pendingAction: (() => void) | null = null;

export function setPendingEditModeAction(action: (() => void) | null) {
	pendingAction = action;
}

function exitEditMode() {
	setEditingTiles(false);
	setEditingTilePositions([]);
	setMultiSelectMode(false);
	setUsingOnlineSearch(false);
}

export default function SaveEditMode() {
	const handleSave = () => {
		saveEditMode();
		exitEditMode();
		setActiveModalId('');
		pendingAction?.();
		pendingAction = null;
	};

	const handleDiscard = () => {
		discardEditMode();
		exitEditMode();
		setActiveModalId('');
		pendingAction?.();
		pendingAction = null;
	};

	const handleCancel = () => {
		setActiveModalId('');
		pendingAction = null;
	};

	return (
		<div class="flex flex-col gap-3">
			<p class="text-sm text-zinc-300">You have unsaved changes. What would you like to do?</p>

			<button
				onClick={handleSave}
				class="flex items-center justify-center gap-2 rounded-md border border-blue-500 bg-blue-600 p-2 text-white transition-colors hover:bg-blue-500"
			>
				<i class="bi bi-check-lg" />
				<span>Save Changes</span>
			</button>

			<button
				onClick={handleDiscard}
				class="flex items-center justify-center gap-2 rounded-md border border-red-500 bg-red-600 p-2 text-white transition-colors hover:bg-red-500"
			>
				<i class="bi bi-trash" />
				<span>Discard Changes</span>
			</button>

			<button
				onClick={handleCancel}
				class="flex items-center justify-center gap-2 rounded-md border border-zinc-600 bg-zinc-700 p-2 text-zinc-200 transition-colors hover:bg-zinc-600"
			>
				<span>Cancel</span>
			</button>
		</div>
	);
}
