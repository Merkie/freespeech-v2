import { createMemo, createSignal, For, Show } from 'solid-js';
import { blobLinkTemplate } from '@/lib/blob-actions';
import { cn } from '@/lib/cn';
import {
	currentPageId,
	getTemplatePagesFromBlob,
	project,
	setActiveModalId,
} from '@/lib/state';
import type { PageBlob, Tile } from '@/lib/types';

// Mini preview for template in list
function TemplateMiniPreview(props: { template: PageBlob }) {
	const currentProject = () => project();
	const columns = () => currentProject()?.columns ?? 4;
	const rows = () => currentProject()?.rows ?? 4;
	const cellSize = 10;
	const gap = 1;

	const getTileAt = (x: number, y: number) => {
		return props.template.tiles.find((t) => t.x === x && t.y === y);
	};

	return (
		<div
			class="inline-grid shrink-0 rounded border border-zinc-600 bg-zinc-900 p-1"
			style={{
				'grid-template-columns': `repeat(${columns()}, ${cellSize}px)`,
				'grid-template-rows': `repeat(${rows()}, ${cellSize}px)`,
				gap: `${gap}px`,
			}}
		>
			<For each={Array.from({ length: rows() })}>
				{(_, y) => (
					<For each={Array.from({ length: columns() })}>
						{(_, x) => {
							const tile = getTileAt(x(), y());
							return (
								<div
									class="rounded-sm"
									style={{
										'background-color': tile ? (tile.backgroundColor ?? '#fafafa') : 'transparent',
										border: tile ? `1px solid ${tile.borderColor ?? '#71717a'}` : 'none',
									}}
								/>
							);
						}}
					</For>
				)}
			</For>
		</div>
	);
}

export default function ApplyTemplate() {
	const [searchQuery, setSearchQuery] = createSignal('');
	const [selectedTemplateId, setSelectedTemplateId] = createSignal<string | null>(null);

	const currentPageIdValue = () => currentPageId();

	// Get templates from blob
	const templates = () => getTemplatePagesFromBlob();

	// Filter templates by search
	const filteredTemplates = createMemo(() => {
		const allTemplates = templates();
		const query = searchQuery().toLowerCase();

		return allTemplates.filter((template) => {
			if (!query) return true;
			return template.name.toLowerCase().includes(query);
		});
	});

	const handleApply = () => {
		const templateId = selectedTemplateId();
		const pageId = currentPageIdValue();
		if (!templateId || !pageId) return;

		blobLinkTemplate(pageId, templateId);
		setActiveModalId('');
	};

	return (
		<div class="flex flex-col gap-4">
			{/* Search input */}
			<div>
				<input
					type="text"
					value={searchQuery()}
					onInput={(e) => setSearchQuery(e.currentTarget.value)}
					placeholder="Search templates..."
					class="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-sm text-white placeholder-zinc-500 outline-none transition-colors focus:border-blue-500"
					autofocus
				/>
			</div>

			{/* Templates list */}
			<div class="max-h-64 overflow-y-auto">
				<Show
					when={filteredTemplates().length > 0}
					fallback={<div class="py-4 text-center text-sm text-zinc-400">No templates found for this project</div>}
				>
					<div class="flex flex-col gap-2">
						<For each={filteredTemplates()}>
							{(template) => (
								<button
									type="button"
									onClick={() => setSelectedTemplateId(template.id)}
									class={cn('flex items-center gap-3 rounded-lg border p-3 text-left transition-all', {
										'border-blue-500 bg-blue-500/10': selectedTemplateId() === template.id,
										'border-zinc-700 bg-zinc-800 hover:border-zinc-600': selectedTemplateId() !== template.id,
									})}
								>
									<TemplateMiniPreview template={template} />
									<div class="flex-1">
										<div class="text-sm font-medium text-white">{template.name}</div>
										<div class="text-xs text-zinc-400">
											{template.tiles.length} tile{template.tiles.length !== 1 ? 's' : ''}
										</div>
									</div>
								</button>
							)}
						</For>
					</div>
				</Show>
			</div>

			<div class="flex justify-end gap-2 pt-2">
				<button
					type="button"
					onClick={() => setActiveModalId('')}
					class="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-all hover:bg-zinc-700 hover:text-white"
				>
					Cancel
				</button>
				<button
					type="button"
					onClick={handleApply}
					disabled={!selectedTemplateId()}
					class={cn('rounded-lg border px-4 py-2 text-sm font-medium transition-all', {
						'border-blue-500 bg-blue-600 text-white hover:bg-blue-500': selectedTemplateId(),
						'cursor-not-allowed border-zinc-700 bg-zinc-800 text-zinc-500': !selectedTemplateId(),
					})}
				>
					Apply Template
				</button>
			</div>
		</div>
	);
}
