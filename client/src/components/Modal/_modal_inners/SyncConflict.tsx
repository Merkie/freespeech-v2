import { Show } from 'solid-js';
import { resolveConflictKeepLocal, resolveConflictUseServer } from '@/lib/blob-sync';
import { conflictServerBlob, projectBlob } from '@/lib/state';

export default function SyncConflict() {
	const localTime = () => {
		const blob = projectBlob();
		return blob?.lastEditedAt ? new Date(blob.lastEditedAt).toLocaleString() : 'Unknown';
	};

	const serverTime = () => {
		const server = conflictServerBlob();
		return server?.lastEditedAt ? new Date(server.lastEditedAt).toLocaleString() : 'Unknown';
	};

	return (
		<div class="flex flex-col gap-4">
			<p class="text-sm text-zinc-400">
				Your local changes conflict with a newer version on the server. Choose which version to keep.
			</p>

			<div class="flex flex-col gap-2 text-sm">
				<div class="flex items-center justify-between rounded-md bg-zinc-800 px-3 py-2">
					<span class="text-zinc-300">Your version</span>
					<span class="text-zinc-500">{localTime()}</span>
				</div>
				<Show when={conflictServerBlob()}>
					<div class="flex items-center justify-between rounded-md bg-zinc-800 px-3 py-2">
						<span class="text-zinc-300">Server version</span>
						<span class="text-zinc-500">{serverTime()}</span>
					</div>
				</Show>
			</div>

			<div class="flex gap-3">
				<button
					onClick={resolveConflictKeepLocal}
					class="flex-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
				>
					Keep my changes
				</button>
				<button
					onClick={resolveConflictUseServer}
					class="flex-1 rounded-md bg-zinc-700 px-3 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-600"
				>
					Use server version
				</button>
			</div>
		</div>
	);
}
