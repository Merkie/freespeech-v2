import { createEffect, createSignal, Show } from 'solid-js';
import { blobRenameTemplate } from '@/lib/blob-actions';
import { cn } from '@/lib/cn';
import { currentPageId, getTemplateForPage, project, setActiveModalId } from '@/lib/state';

export default function EditTemplateDetails() {
	const [name, setName] = createSignal('');
	const [error, setError] = createSignal('');

	const template = () => getTemplateForPage(currentPageId());

	// Initialize name from template
	createEffect(() => {
		const t = template();
		if (t) {
			setName(t.name);
		}
	});

	const handleSubmit = (e: Event) => {
		e.preventDefault();
		const t = template();
		if (!name().trim() || !t) return;

		setError('');

		try {
			blobRenameTemplate(t.id, name().trim());
			setActiveModalId('');
		} catch (_err) {
			setError('Failed to update template');
		}
	};

	const isValid = () => name().trim().length > 0;
	const hasChanges = () => {
		const t = template();
		return t && name().trim() !== t.name;
	};

	const currentProject = () => project();

	return (
		<form onSubmit={handleSubmit} class="flex flex-col gap-4">
			<Show when={template()} fallback={<p class="text-sm text-zinc-400">No template selected</p>}>
				<div>
					<label class="mb-2 block text-sm font-medium text-zinc-300">Template Name</label>
					<input
						type="text"
						value={name()}
						onInput={(e) => setName(e.currentTarget.value)}
						placeholder="Template name..."
						class="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-sm text-white placeholder-zinc-500 outline-none transition-colors focus:border-blue-500"
						autofocus
					/>
				</div>

				<p class="text-sm text-zinc-400">
					Dimensions: {currentProject()?.columns} x {currentProject()?.rows}
				</p>

				<Show when={error()}>
					<p class="text-sm text-red-400">{error()}</p>
				</Show>

				<div class="flex justify-end gap-2 pt-2">
					<button
						type="button"
						onClick={() => setActiveModalId('')}
						class="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-all hover:bg-zinc-700 hover:text-white"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={!isValid() || !hasChanges()}
						class={cn('rounded-lg border px-4 py-2 text-sm font-medium transition-all', {
							'border-blue-500 bg-blue-600 text-white hover:bg-blue-500': isValid() && hasChanges(),
							'cursor-not-allowed border-zinc-700 bg-zinc-800 text-zinc-500':
								!isValid() || !hasChanges(),
						})}
					>
						Save Changes
					</button>
				</div>
			</Show>
		</form>
	);
}
