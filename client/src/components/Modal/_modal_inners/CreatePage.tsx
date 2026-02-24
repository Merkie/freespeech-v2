import { createSignal, Show } from 'solid-js';
import { blobCreatePage } from '@/lib/blob-actions';
import { cn } from '@/lib/cn';
import { MODAL_ID } from '@/lib/constants';
import { setActiveModalId } from '@/lib/state';

export default function CreatePage() {
	const [name, setName] = createSignal('');
	const [error, setError] = createSignal('');

	const handleSubmit = (e: Event) => {
		e.preventDefault();
		if (!name().trim()) return;

		setError('');

		try {
			// Create page via blob mutation — instant, no network call
			blobCreatePage(name().trim());

			// Go back to manage pages modal
			setActiveModalId(MODAL_ID.MANAGE_PAGES);
		} catch (_err) {
			setError('Failed to create page');
		}
	};

	const isValid = () => name().trim().length > 0;

	return (
		<form onSubmit={handleSubmit} class="flex flex-col gap-4">
			<div>
				<label class="mb-2 block text-sm font-medium text-zinc-300">Page Name</label>
				<input
					type="text"
					value={name()}
					onInput={(e) => setName(e.currentTarget.value)}
					placeholder="Food, Activities, Feelings..."
					class="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-sm text-white placeholder-zinc-500 outline-none transition-colors focus:border-blue-500"
					autofocus
				/>
			</div>

			<Show when={error()}>
				<p class="text-sm text-red-400">{error()}</p>
			</Show>

			<div class="flex justify-end gap-2 pt-2">
				<button
					type="button"
					onClick={() => setActiveModalId(MODAL_ID.MANAGE_PAGES)}
					class="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-all hover:bg-zinc-700 hover:text-white"
				>
					Back
				</button>
				<button
					type="submit"
					disabled={!isValid()}
					class={cn('rounded-lg border px-4 py-2 text-sm font-medium transition-all', {
						'border-blue-500 bg-blue-600 text-white hover:bg-blue-500': isValid(),
						'cursor-not-allowed border-zinc-700 bg-zinc-800 text-zinc-500': !isValid(),
					})}
				>
					Create Page
				</button>
			</div>
		</form>
	);
}
