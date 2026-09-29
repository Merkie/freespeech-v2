// Pending action to execute after save/discard (e.g., navigate home)
export let pendingAction: (() => void | Promise<void>) | null = null;

export function setPendingEditModeAction(action: (() => void | Promise<void>) | null) {
	pendingAction = action;
}
