import { For } from 'solid-js';
import { project } from '@/lib/state';

export default function ProjectContentSkeleton() {
	const projectColumns = () => project()?.columns || 6;
	const projectRows = () => project()?.rows || 4;

	return (
		<div
			style={{
				'grid-template-columns': `repeat(${projectColumns()}, 1fr)`,
				'grid-template-rows': `repeat(${projectRows()}, 1fr)`,
			}}
			class="grid flex-1 gap-2 bg-zinc-100 p-2"
		>
			<For each={Array.from({ length: projectColumns() * projectRows() }, (_, i) => i)}>
				{(_) => (
					<div class="relative col-span-1 row-span-1 rounded bg-zinc-200">
						<div class="animate-shine absolute top-0 left-0 h-full w-full opacity-20"></div>
					</div>
				)}
			</For>
		</div>
	);
}
