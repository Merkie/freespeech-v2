import type { CachedProjectBlob } from './types';

export type SyncReconciliation = {
	entry: CachedProjectBlob;
	needsAnotherSync: boolean;
};

/**
 * Applies a successful server timestamp without ever declaring a newer local revision clean.
 *
 * The request may have spent long enough on the network for another edit to reach IndexedDB.
 * When that happens the newer blob is rebased onto the timestamp returned for the older request
 * and remains dirty, so the next sync sends it instead of silently dropping it.
 */
export function reconcileSuccessfulSync(
	entry: CachedProjectBlob,
	sentRevision: number,
	serverLastEditedAt: string,
): SyncReconciliation {
	const currentRevision = entry.revision ?? 0;
	const needsAnotherSync = currentRevision !== sentRevision;

	return {
		entry: {
			...entry,
			blob: { ...entry.blob, lastEditedAt: serverLastEditedAt },
			dirty: needsAnotherSync,
			revision: currentRevision,
		},
		needsAnotherSync,
	};
}
