import { useNavigate } from '@solidjs/router';
import { createResource, createSignal, For, Match, Show, Switch } from 'solid-js';
import api from '@/lib/api';
import type { TemplateSummary } from '@/lib/api/endpoints/project';
import { cn } from '@/lib/cn';
import { setActiveModalId } from '@/lib/state';
import ImportBoard from './ImportBoard';

type Step = 'type' | 'blank' | 'template' | 'import';

export default function CreateProject() {
	const [step, setStep] = createSignal<Step>('type');

	return (
		<div class="flex flex-col gap-4">
			<Show when={step() !== 'type'}>
				<button
					type="button"
					onClick={() => setStep('type')}
					class="flex w-fit items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-white"
				>
					<i class="bi bi-arrow-left" />
					<span>Back</span>
				</button>
			</Show>

			<Switch>
				<Match when={step() === 'type'}>
					<div class="grid grid-rows-3 gap-3">
						<TypeButton
							icon="plus-square-dotted"
							title="Blank Project"
							description="Start from scratch with an empty project"
							onClick={() => setStep('blank')}
						/>
						<TypeButton
							icon="file-earmark-code"
							title="Use Template"
							description="Choose from pre-made project templates"
							onClick={() => setStep('template')}
						/>
						<TypeButton
							icon="file-earmark-arrow-up"
							title="Import File"
							description="Import an existing project from a file"
							onClick={() => setStep('import')}
						/>
					</div>
				</Match>
				<Match when={step() === 'blank'}>
					<BlankProjectForm />
				</Match>
				<Match when={step() === 'template'}>
					<TemplateStep />
				</Match>
				<Match when={step() === 'import'}>
					<ImportBoard />
				</Match>
			</Switch>
		</div>
	);
}

function TypeButton(props: { icon: string; title: string; description: string; onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={props.onClick}
			class="flex w-full flex-col items-center rounded-lg border border-zinc-700 bg-zinc-800 p-5 text-center transition-all hover:border-zinc-500 hover:bg-zinc-700/60 active:brightness-90"
		>
			<i class={`bi bi-${props.icon} mb-2 text-4xl text-zinc-200`} />
			<p class="text-lg font-bold text-white">{props.title}</p>
			<p class="text-sm text-zinc-400">{props.description}</p>
		</button>
	);
}

function BlankProjectForm() {
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

// Importing a template runs the full server-side board import, so a click is not instant.
function TemplateStep() {
	const navigate = useNavigate();
	const [templates] = createResource<TemplateSummary[]>(async () => {
		const response = await api.project.listTemplates();
		return response.templates;
	});
	const [busySlug, setBusySlug] = createSignal('');
	const [error, setError] = createSignal('');

	const useTemplate = async (template: TemplateSummary) => {
		if (busySlug()) return;
		setBusySlug(template.slug);
		setError('');

		try {
			const response = await api.project.importTemplate(template.slug);
			if (response.error || !response.projectId) {
				setError(response.error || 'That template could not be imported.');
				return;
			}
			api.project.updateThumbnail(response.projectId).catch(() => {});
			setActiveModalId('');
			navigate(`/app/project/${response.projectId}`);
		} catch (_err) {
			setError('That template could not be imported.');
		} finally {
			setBusySlug('');
		}
	};

	return (
		<div class="flex flex-col gap-3">
			<p class="text-sm text-zinc-300">Pick a pre-built vocabulary set. You can edit everything afterwards.</p>

			<Show
				when={!templates.loading}
				fallback={
					<div class="flex items-center justify-center gap-3 py-8 text-zinc-400">
						<div class="h-5 w-5 animate-spin rounded-full border-2 border-zinc-500 border-t-transparent" />
						<span class="text-sm">Loading templates...</span>
					</div>
				}
			>
				<Show
					when={!templates.error && (templates()?.length ?? 0) > 0}
					fallback={<p class="py-4 text-center text-sm text-zinc-400">Templates could not be loaded right now.</p>}
				>
					<div class="flex max-h-[50vh] flex-col gap-2 overflow-y-auto pr-1">
						<For each={templates()}>
							{(template) => (
								<button
									type="button"
									onClick={() => useTemplate(template)}
									disabled={!!busySlug()}
									class={cn(
										'flex w-full items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-800 p-3 text-left transition-all',
										busySlug() ? 'cursor-wait opacity-60' : 'hover:border-zinc-500 hover:bg-zinc-700/60',
										busySlug() === template.slug && 'border-blue-500 opacity-100',
									)}
								>
									<div class="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white p-1">
										<img src={template.thumbnailUrl} alt="" class="max-h-full max-w-full object-contain" />
									</div>
									<div class="min-w-0 flex-1">
										<p class="truncate font-semibold text-white">{template.name}</p>
										<p class="truncate text-xs italic text-zinc-500">By {template.creatorName}</p>
										<p class="line-clamp-2 text-xs text-zinc-400">{template.description}</p>
									</div>
									<Show
										when={busySlug() === template.slug}
										fallback={<i class="bi bi-chevron-right shrink-0 text-zinc-500" />}
									>
										<i class="bi bi-arrow-repeat shrink-0 animate-spin text-zinc-300" />
									</Show>
								</button>
							)}
						</For>
					</div>
				</Show>
			</Show>

			<Show when={busySlug()}>
				<p class="text-center text-xs text-zinc-500">Creating your project — this can take a minute...</p>
			</Show>

			<Show when={error()}>
				<div class="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">{error()}</div>
			</Show>
		</div>
	);
}
