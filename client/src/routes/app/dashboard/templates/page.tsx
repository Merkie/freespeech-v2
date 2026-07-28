import { useNavigate } from '@solidjs/router';
import type { Component } from 'solid-js';
import { createResource, createSignal, For, Show } from 'solid-js';
import api from '@/lib/api';
import type { TemplateSummary } from '@/lib/api/endpoints/project';

const TemplatesPage: Component = () => {
	const navigate = useNavigate();
	const [templates] = createResource<TemplateSummary[]>(async () => {
		const response = await api.project.listTemplates();
		return response.templates;
	});

	return (
		<div class="min-h-full bg-zinc-100">
			<div class="mx-auto max-w-[1500px] px-6 py-8 md:px-12 lg:px-[100px]">
				<div class="mb-6">
					<h1 class="text-2xl font-semibold text-zinc-800">Starter Templates</h1>
					<p class="mt-1 text-sm text-zinc-500">
						Pick a pre-built vocabulary set to kick off a new project. You can edit everything after importing.
					</p>
				</div>

				<Show
					when={!templates.loading}
					fallback={
						<div class="flex items-center justify-center py-16 text-zinc-400">
							<div class="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
							<span>Loading templates...</span>
						</div>
					}
				>
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
						<For each={templates()}>
							{(template) => <TemplateCard template={template} onImported={(id) => navigate(`/app/project/${id}`)} />}
						</For>
					</div>
				</Show>
			</div>
		</div>
	);
};

function TemplateCard(props: { template: TemplateSummary; onImported: (projectId: string) => void }) {
	const [loading, setLoading] = createSignal(false);

	const handleUse = async () => {
		if (loading()) return;
		setLoading(true);
		// On failure the button simply returns to "Use template".
		const response = await api.project.importTemplate(props.template.slug).catch(() => undefined);
		if (!response || response.error || !response.projectId) {
			setLoading(false);
			return;
		}
		api.project.updateThumbnail(response.projectId).catch(() => undefined);
		props.onImported(response.projectId);
	};

	return (
		<div class="flex flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md">
			<div class="flex h-[200px] items-center justify-center bg-zinc-50 p-4">
				<img src={props.template.thumbnailUrl} alt={props.template.name} class="h-full w-full object-contain" />
			</div>
			<div class="flex flex-1 flex-col p-4">
				<p class="text-lg font-semibold text-zinc-800">{props.template.name}</p>
				<p class="text-xs italic text-zinc-500">Created by {props.template.creatorName}</p>
				<p class="mt-2 flex-1 text-sm text-zinc-600">{props.template.description}</p>
				<button
					onClick={handleUse}
					disabled={loading()}
					class="mt-4 rounded-md bg-blue-500 px-4 py-2 text-sm font-semibold uppercase tracking-wider text-white transition-all hover:brightness-110 active:brightness-90 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{loading() ? 'Creating project...' : 'Use template'}
				</button>
			</div>
		</div>
	);
}

export default TemplatesPage;
