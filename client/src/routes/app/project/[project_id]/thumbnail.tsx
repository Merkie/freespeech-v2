import { useParams } from '@solidjs/router';
import { createEffect, createSignal, on, Show } from 'solid-js';
import { loadProject, navigateToPageInProject } from '@/lib/page-actions';
import { currentPageId, projectBlob } from '@/lib/state';
import TileSubpages from './_components/ProjectContent/TileSubpages';

export default function ThumbnailPage() {
	const params = useParams();
	const [containerHeight, setContainerHeight] = createSignal(0);
	const [ready, setReady] = createSignal(false);

	const handleRef = (el: HTMLDivElement) => {
		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) setContainerHeight(entry.contentRect.height);
		});
		observer.observe(el);
	};

	createEffect(
		on([() => params.project_id, () => params.page_id], async ([projectId, pageId]) => {
			if (!projectId) return;
			const success = await loadProject(projectId);
			if (!success) return;
			if (pageId) navigateToPageInProject(pageId);
			setReady(true);
		}),
	);

	return (
		<Show when={ready() && projectBlob() && currentPageId()}>
			<div ref={handleRef} class="pointer-events-none fixed inset-0 overflow-hidden bg-zinc-100">
				<Show when={containerHeight() > 0}>
					<TileSubpages containerHeight={containerHeight} />
				</Show>
			</div>
		</Show>
	);
}
