import { useNavigate } from '@solidjs/router';
import { createSignal, Show } from 'solid-js';
import api from '@/lib/api';
import { cn } from '@/lib/cn';
import { setActiveModalId } from '@/lib/state';

export default function CreateProject() {
	const navigate = useNavigate();
	const [name, setName] = createSignal('');
	const [columns, setColumns] = createSignal(6);
	const [rows, setRows] = createSignal(4);
	const [showAdvanced, setShowAdvanced] = createSignal(false);
	const [isLoading, setIsLoading] = createSignal(false);
	const [error, setError] = createSignal('');

	const handleSubmit = async (e: Event) => {
		e.preventDefault();
		if (isLoading() || !name().trim()) return;

		setIsLoading(true);
		setError('');

		try {
			const response = await api.project.create({
				name: name().trim(),
				columns: columns(),
				rows: rows(),
			});

			if (response.error) {
				setError(response.error);
				setIsLoading(false);
				return;
			}

			if (response.projectId) {
				await api.project.updateThumbnail(response.projectId);
				setActiveModalId('');
				navigate(`/app/project/${response.projectId}`);
			}
		} catch (_err) {
			setError('Failed to create project');
			setIsLoading(false);
		}
	};

	const isValid = () => name().trim().length > 0;

	return (
		<form onSubmit={handleSubmit} class="flex flex-col gap-4">
			<div>
				<label class="mb-2 block text-sm font-medium text-zinc-300">Project Name</label>
				<input
					type="text"
					value={name()}
					onInput={(e) => setName(e.currentTarget.value)}
					placeholder="My Communication Board"
					class="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-sm text-white placeholder-zinc-500 outline-none transition-colors focus:border-blue-500"
					autofocus
				/>
			</div>

			<Show when={showAdvanced()}>
				<div>
					<label class="mb-2 block text-sm font-medium text-zinc-300">Grid Dimensions</label>
					<div class="flex items-center gap-2">
						<input
							type="number"
							value={columns()}
							onInput={(e) => setColumns(parseInt(e.currentTarget.value, 10) || 6)}
							min={1}
							max={12}
							class="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-sm text-white outline-none transition-colors focus:border-blue-500"
							placeholder="Columns"
						/>
						<span class="text-zinc-400">×</span>
						<input
							type="number"
							value={rows()}
							onInput={(e) => setRows(parseInt(e.currentTarget.value, 10) || 4)}
							min={1}
							max={12}
							class="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-sm text-white outline-none transition-colors focus:border-blue-500"
							placeholder="Rows"
						/>
					</div>
				</div>
			</Show>

			<Show when={!showAdvanced()}>
				<button
					type="button"
					onClick={() => setShowAdvanced(true)}
					class="text-left text-sm text-zinc-400 hover:text-zinc-300 hover:underline"
				>
					Show advanced settings
				</button>
			</Show>

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
					disabled={!isValid() || isLoading()}
					class={cn('rounded-lg border px-4 py-2 text-sm font-medium transition-all', {
						'border-blue-500 bg-blue-600 text-white hover:bg-blue-500': isValid() && !isLoading(),
						'cursor-not-allowed border-zinc-700 bg-zinc-800 text-zinc-500': !isValid() || isLoading(),
					})}
				>
					{isLoading() ? 'Creating...' : 'Create Project'}
				</button>
			</div>
		</form>
	);
}
