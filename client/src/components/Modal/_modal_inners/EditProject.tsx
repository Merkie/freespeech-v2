import { createSignal, Show } from 'solid-js';
import api from '@/lib/api';
import { OfflineError } from '@/lib/api/util';
import { cacheRemoteBlob, getCachedBlobEntry } from '@/lib/cache/blob-cache';
import { cn } from '@/lib/cn';
import { projectBeingEdited, setActiveModalId, setProjectBeingEdited, setSavedProjectSettings } from '@/lib/state';

const inputClass =
	'h-10 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-sm text-white placeholder-zinc-500 outline-none transition-colors focus:border-blue-500';

export default function EditProject() {
	const project = projectBeingEdited();
	const [name, setName] = createSignal(project?.name ?? '');
	const [columns, setColumns] = createSignal(project?.columns ?? 6);
	const [rows, setRows] = createSignal(project?.rows ?? 4);
	const [error, setError] = createSignal('');
	const [saving, setSaving] = createSignal(false);
	const maxColumns = Math.max(12, project?.columns ?? 0);
	const maxRows = Math.max(12, project?.rows ?? 0);

	const isValid = () =>
		!!name().trim() && columns() >= 1 && columns() <= maxColumns && rows() >= 1 && rows() <= maxRows;

	const close = () => {
		setProjectBeingEdited(null);
		setActiveModalId('');
	};

	const handleSubmit = async (e: Event) => {
		e.preventDefault();
		if (!project || !isValid() || saving()) return;
		setError('');
		setSaving(true);
		try {
			const result = await api.project.updateSettings(project.id, {
				name: name().trim(),
				columns: columns(),
				rows: rows(),
			});
			if (!result.success || !result.project) {
				setError(result.error === 'zodError' ? 'Check the name and grid size.' : result.error || 'Could not save.');
				return;
			}
			const saved = result.project;
			// Keep a clean device copy current so the offline dashboard and next launch match.
			const entry = await getCachedBlobEntry(project.id).catch(() => undefined);
			if (entry && !entry.dirty) {
				await cacheRemoteBlob(
					{
						...entry.blob,
						name: saved.name,
						columns: saved.columns,
						rows: saved.rows,
						lastEditedAt: saved.lastEditedAt,
					},
					entry.revision ?? 0,
				).catch(() => false);
			}
			setSavedProjectSettings(saved);
			close();
		} catch (err) {
			setError(
				err instanceof OfflineError ? 'Connect to the internet to change this project.' : 'Could not save. Try again.',
			);
		} finally {
			setSaving(false);
		}
	};

	return (
		<form onSubmit={handleSubmit} class="flex flex-col gap-4">
			<div>
				<label for="edit-project-name" class="mb-2 block text-sm font-medium text-zinc-300">
					Name
				</label>
				<input
					id="edit-project-name"
					type="text"
					value={name()}
					onInput={(e) => setName(e.currentTarget.value)}
					maxLength={100}
					class={inputClass}
					autofocus
				/>
			</div>
			<div>
				<p class="mb-2 block text-sm font-medium text-zinc-300">Grid size (columns × rows)</p>
				<div class="flex items-center gap-2">
					<input
						type="number"
						aria-label="Columns"
						value={columns()}
						onInput={(e) => setColumns(parseInt(e.currentTarget.value, 10) || 0)}
						min={1}
						max={maxColumns}
						class={inputClass}
					/>
					<span class="text-zinc-400">×</span>
					<input
						type="number"
						aria-label="Rows"
						value={rows()}
						onInput={(e) => setRows(parseInt(e.currentTarget.value, 10) || 0)}
						min={1}
						max={maxRows}
						class={inputClass}
					/>
				</div>
			</div>

			<Show when={error()}>
				<p class="text-sm text-red-400">{error()}</p>
			</Show>

			<div class="flex justify-end gap-2 pt-2">
				<button
					type="button"
					onClick={close}
					class="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-all hover:bg-zinc-700 hover:text-white"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={!isValid() || saving()}
					class={cn('rounded-lg border px-4 py-2 text-sm font-medium transition-all', {
						'border-blue-500 bg-blue-600 text-white hover:bg-blue-500': isValid() && !saving(),
						'cursor-not-allowed border-zinc-700 bg-zinc-800 text-zinc-500': !isValid() || saving(),
					})}
				>
					{saving() ? 'Saving...' : 'Save Changes'}
				</button>
			</div>
		</form>
	);
}
