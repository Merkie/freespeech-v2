import { A } from '@solidjs/router';
import type { Component } from 'solid-js';
import { createSignal, onMount, Show } from 'solid-js';
import useOutsideClick from '@/hooks/useOutsideClick';
import api from '@/lib/api';
import { deleteCachedBlob, isBlobCached } from '@/lib/cache/blob-cache';
import { MODAL_ID } from '@/lib/constants';
import { lastVisitedProjectId } from '@/lib/page-actions';
import { localSettings, setActiveModalId, setLocalSettings, setProjectToOptimize } from '@/lib/state';
import type { Project } from '@/lib/types';

interface ProjectCardProps {
	project: Project;
	onToggleFavorite?: (projectId: string, newValue: boolean) => void;
	onDelete?: (projectId: string) => void;
}

const ProjectCard: Component<ProjectCardProps> = (props) => {
	// Read from localStorage, not the in-memory project() signal: that one is only populated once a
	// board has been opened this session, so the badge vanished on every refresh of the dashboard.
	const selected = () => lastVisitedProjectId() === props.project.id;
	const [menuOpen, setMenuOpen] = createSignal(false);
	const [cardRef, setCardRef] = createSignal<HTMLDivElement | undefined>(undefined);
	const [cached, setCached] = createSignal(false);
	const [favoriteOverride, setFavoriteOverride] = createSignal<boolean | null>(null);

	onMount(async () => {
		setCached(await isBlobCached(props.project.id));
	});

	const isFavorite = () => favoriteOverride() ?? props.project.isFavorite;
	const projectUrl = () => `/app/project/${props.project.id}`;

	useOutsideClick(cardRef, () => {
		if (!menuOpen()) return;
		setMenuOpen(false);
	});

	const handleMenuClick = (e: MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setMenuOpen(!menuOpen());
	};

	const handleToggleFavorite = async (e: MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setMenuOpen(false);
		const newValue = !isFavorite();
		setFavoriteOverride(newValue);
		try {
			await api.project.toggleFavorite(props.project.id);
			props.onToggleFavorite?.(props.project.id, newValue);
		} catch {
			setFavoriteOverride(null);
		}
	};

	const handleOptimizeImages = (e: MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setMenuOpen(false);
		setProjectToOptimize({ id: props.project.id, name: props.project.name });
		setActiveModalId(MODAL_ID.OPTIMIZE_IMAGES);
	};

	const handleRename = (e: MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setMenuOpen(false);
		// TODO: Implement rename functionality
	};

	const handleDuplicate = (e: MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setMenuOpen(false);
		// TODO: Implement duplicate functionality
	};

	const handleDelete = async (e: MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setMenuOpen(false);

		const confirmed = window.confirm(`Delete "${props.project.name}"? This can't be undone.`);
		if (!confirmed) return;

		// A failed delete leaves the card in place; a successful one removes it.
		const response = await api.project.delete(props.project.id).catch(() => undefined);
		if (!response?.success) return;

		await deleteCachedBlob(props.project.id).catch(() => undefined);
		const settings = localSettings();
		if (settings.lastVisitedProjectId === props.project.id) {
			setLocalSettings({
				...settings,
				lastVisitedProjectId: '',
				lastVisitedPageId: '',
			});
		}
		props.onDelete?.(props.project.id);
	};

	return (
		<div ref={setCardRef} class="relative">
			<A
				href={projectUrl()}
				class="relative flex h-fit w-full flex-col gap-4 rounded-lg border border-zinc-300 bg-zinc-200 p-2 shadow-sm"
				classList={{
					'border-blue-200 ring-4 ring-blue-200 ring-offset-2 ring-offset-zinc-100': selected(),
				}}
			>
				{/*
				  A blank project has no thumbnail until one is rendered, and imageUrl is null until then.
				  Interpolating that into the src produces a request for ".../null", so the card would show
				  a broken-image glyph rather than the empty placeholder it shows today.
				*/}
				<Show when={props.project.imageUrl} fallback={<div class="aspect-video w-full rounded-md bg-zinc-100" />}>
					<img
						src={`${import.meta.env.VITE_R2_URL}${props.project.imageUrl}`}
						class="aspect-video w-full rounded-md bg-zinc-100 object-cover p-1 text-zinc-100"
						alt="preview"
					/>
				</Show>

				<div class="flex w-full items-center gap-2 text-lg">
					{/* Grouped so the icons stay next to the name instead of drifting to the SELECTED chip. */}
					<div class="flex min-w-0 flex-1 items-center gap-2">
						<Show when={isFavorite()}>
							<i class="bi bi-star-fill shrink-0 text-base leading-none text-amber-400" />
						</Show>
						<p class="truncate whitespace-nowrap">{props.project.name}</p>
						<Show when={cached()}>
							<i
								class="bi bi-cloud-check-fill shrink-0 text-sm leading-none text-zinc-600/40"
								title="Saved on this device for offline use"
							/>
						</Show>
					</div>
					<Show when={selected()}>
						<div class="rounded-md bg-blue-500 p-1 px-2 text-sm font-bold text-white shadow-md">SELECTED</div>
					</Show>
				</div>

				<Show when={selected()}>
					<div class="pointer-events-none absolute left-0 top-0 h-full w-full bg-blue-200/[20%]" />
				</Show>
			</A>

			{/*
			  A sibling of the anchor rather than a child of it: a button nested inside a link is invalid
			  markup, and the wrapper is already positioned for exactly this. Inset from the card corner so
			  it floats over the thumbnail instead of sitting on its edge.

			  `leading-none` is what centres the glyph — a bootstrap icon is sized by its line box, not its
			  glyph, so the default line height would push it off-centre inside the circle.

			  Opaque with a border rather than a translucent white: board thumbnails are predominantly
			  white, and a semi-transparent button disappears into them entirely.
			*/}
			<button
				type="button"
				onClick={handleMenuClick}
				aria-label={`Options for ${props.project.name}`}
				class="absolute right-8 top-8 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 bg-white text-zinc-600 shadow-md transition-all hover:bg-zinc-100 hover:text-zinc-900"
			>
				<i class="bi bi-three-dots text-base leading-none" />
			</button>

			{/* Context Menu */}
			<div
				style={{
					'pointer-events': menuOpen() ? 'auto' : 'none',
					opacity: menuOpen() ? 1 : 0,
					'user-select': 'none',
					top: menuOpen() ? '72px' : '66px',
				}}
				class="absolute right-8 z-10 flex w-fit flex-col whitespace-nowrap rounded-md border border-zinc-200 bg-white p-2 text-sm shadow-lg transition-all"
			>
				<button
					onClick={handleToggleFavorite}
					class="flex items-center gap-2 rounded-md p-1 px-2 text-left text-zinc-700 transition-all hover:bg-zinc-100"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-4 w-4"
						viewBox="0 0 24 24"
						fill={isFavorite() ? 'currentColor' : 'none'}
						stroke="currentColor"
						stroke-width="2"
						classList={{ 'text-amber-400': isFavorite() }}
					>
						<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
					</svg>
					{isFavorite() ? 'Remove from Favorites' : 'Add to Favorites'}
				</button>
				<button
					onClick={handleRename}
					class="flex items-center gap-2 rounded-md p-1 px-2 text-left text-zinc-700 transition-all hover:bg-zinc-100"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-4 w-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
						/>
					</svg>
					Rename
				</button>
				<button
					onClick={handleDuplicate}
					class="flex items-center gap-2 rounded-md p-1 px-2 text-left text-zinc-700 transition-all hover:bg-zinc-100"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-4 w-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
						/>
					</svg>
					Duplicate
				</button>
				<button
					onClick={handleOptimizeImages}
					class="flex items-center gap-2 rounded-md p-1 px-2 text-left text-zinc-700 transition-all hover:bg-zinc-100"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-4 w-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
						/>
					</svg>
					Optimize Images
				</button>

				<div class="my-2 border-t border-zinc-200" />

				<button
					onClick={handleDelete}
					class="flex items-center gap-2 rounded-md p-1 px-2 text-left text-red-500 transition-all hover:bg-red-50"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-4 w-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
						/>
					</svg>
					Delete
				</button>
			</div>
		</div>
	);
};

export default ProjectCard;
