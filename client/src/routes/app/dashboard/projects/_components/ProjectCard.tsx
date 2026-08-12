import { A } from '@solidjs/router';
import type { Component } from 'solid-js';
import { createSignal, onMount, Show } from 'solid-js';
import useOutsideClick from '@/hooks/useOutsideClick';
import api from '@/lib/api';
import { deleteCachedBlob, isBlobCached } from '@/lib/cache/blob-cache';
import { MODAL_ID } from '@/lib/constants';
import { lastVisitedProjectId } from '@/lib/page-actions';
import {
	localSettings,
	setActiveModalId,
	setLocalSettings,
	setProjectToCollaborate,
	setProjectToOptimize,
} from '@/lib/state';
import type { Project } from '@/lib/types';

interface ProjectCardProps {
	project: Project;
	onToggleFavorite?: (projectId: string, newValue: boolean) => void;
	onDelete?: (projectId: string) => void;
	onDuplicate?: () => void | Promise<void>;
}

const ProjectCard: Component<ProjectCardProps> = (props) => {
	// Read from localStorage, not the in-memory project() signal: that one is only populated once a
	// board has been opened this session, so the badge vanished on every refresh of the dashboard.
	const selected = () => lastVisitedProjectId() === props.project.id;
	const [menuOpen, setMenuOpen] = createSignal(false);
	const [cardRef, setCardRef] = createSignal<HTMLDivElement | undefined>(undefined);
	const [cached, setCached] = createSignal(false);
	const [favoriteOverride, setFavoriteOverride] = createSignal<boolean | null>(null);
	const [duplicating, setDuplicating] = createSignal(false);

	onMount(async () => {
		setCached(await isBlobCached(props.project.id));
	});

	const isFavorite = () => favoriteOverride() ?? props.project.isFavorite;
	const isShared = () => props.project.accessRole === 'collaborator';
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

	const handleManageCollaborators = (e: MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setMenuOpen(false);
		setProjectToCollaborate({ id: props.project.id, name: props.project.name });
		setActiveModalId(MODAL_ID.MANAGE_COLLABORATORS);
	};

	const handleDuplicate = async (e: MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setMenuOpen(false);
		if (duplicating()) return;

		setDuplicating(true);
		try {
			const response = await api.project.duplicate(props.project.id);
			if (!response.success || !response.project) return;
			await props.onDuplicate?.();
			void api.project
				.updateThumbnail(response.project.id)
				.then(() => props.onDuplicate?.())
				.catch(() => undefined);
		} finally {
			setDuplicating(false);
		}
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

	const handleLeave = async (e: MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setMenuOpen(false);

		const confirmed = window.confirm(`Leave the shared board "${props.project.name}"?`);
		if (!confirmed) return;
		const response = await api.project.leaveCollaboration(props.project.id).catch(() => undefined);
		if (!response?.success) return;

		await deleteCachedBlob(props.project.id).catch(() => undefined);
		const settings = localSettings();
		if (settings.lastVisitedProjectId === props.project.id) {
			setLocalSettings({ ...settings, lastVisitedProjectId: '', lastVisitedPageId: '' });
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
						<Show when={isShared()}>
							<span
								title={`Shared by ${props.project.owner?.name ?? 'another FreeSpeech user'}`}
								class="flex shrink-0 items-center gap-1 rounded-full bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-700"
							>
								<i class="bi bi-people-fill leading-none" />
								Shared
							</span>
						</Show>
						<Show when={cached()}>
							{/*
							  An optical nudge, not a fix for a broken box. items-center already lands the glyph
							  within 0.1px of the centre of the label's full ascender-to-baseline ink, but a
							  mostly-lowercase name carries its visual weight in the x-height band, ~1.75px lower,
							  so a truly centred icon reads high. 1px splits the difference between the two.
							*/}
							<i
								class="bi bi-cloud-check-fill relative top-px shrink-0 text-sm leading-none text-zinc-600/40"
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
				class="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 bg-white text-zinc-600 shadow-md transition-all hover:bg-zinc-100 hover:text-zinc-900"
			>
				<i class="bi bi-three-dots text-base leading-none" />
			</button>

			{/* Context Menu */}
			<div
				style={{
					'pointer-events': menuOpen() ? 'auto' : 'none',
					opacity: menuOpen() ? 1 : 0,
					'user-select': 'none',
					// Clears the trigger, which ends at 48px: top-4 (16px) plus its own h-8 (32px).
					top: menuOpen() ? '56px' : '50px',
				}}
				class="absolute right-4 z-10 flex w-fit flex-col whitespace-nowrap rounded-md border border-zinc-200 bg-white p-2 text-sm shadow-lg transition-all"
			>
				<button
					type="button"
					onClick={handleToggleFavorite}
					class="flex items-center gap-2 rounded-md p-1 px-2 text-left text-zinc-700 transition-all hover:bg-zinc-100"
				>
					<i class={`bi ${isFavorite() ? 'bi-star-fill text-amber-400' : 'bi-star'} text-base leading-none`} />
					{isFavorite() ? 'Remove from Favorites' : 'Add to Favorites'}
				</button>
				<Show when={!isShared()}>
					<button
						type="button"
						onClick={handleRename}
						class="flex items-center gap-2 rounded-md p-1 px-2 text-left text-zinc-700 transition-all hover:bg-zinc-100"
					>
						<i class="bi bi-pencil text-base leading-none" />
						Rename
					</button>
				</Show>
				<button
					type="button"
					onClick={handleDuplicate}
					disabled={duplicating()}
					class="flex items-center gap-2 rounded-md p-1 px-2 text-left text-zinc-700 transition-all hover:bg-zinc-100"
				>
					<i class={`bi ${duplicating() ? 'bi-arrow-repeat animate-spin' : 'bi-copy'} text-base leading-none`} />
					{duplicating() ? 'Duplicating…' : 'Duplicate'}
				</button>
				<Show when={!isShared() && props.project.collaborationEnabled}>
					<button
						type="button"
						onClick={handleManageCollaborators}
						class="flex items-center gap-2 rounded-md p-1 px-2 text-left text-zinc-700 transition-all hover:bg-sky-50 hover:text-sky-700"
					>
						<i class="bi bi-people text-base leading-none" />
						Manage Collaborators
					</button>
				</Show>
				<button
					type="button"
					onClick={handleOptimizeImages}
					class="flex items-center gap-2 rounded-md p-1 px-2 text-left text-zinc-700 transition-all hover:bg-zinc-100"
				>
					<i class="bi bi-images text-base leading-none" />
					Optimize Images
				</button>

				<div class="my-2 border-t border-zinc-200" />

				<button
					type="button"
					onClick={isShared() ? handleLeave : handleDelete}
					class="flex items-center gap-2 rounded-md p-1 px-2 text-left text-red-500 transition-all hover:bg-red-50"
				>
					<i class={`bi ${isShared() ? 'bi-box-arrow-right' : 'bi-trash'} text-base leading-none`} />
					{isShared() ? 'Leave Shared Board' : 'Delete'}
				</button>
			</div>
		</div>
	);
};

export default ProjectCard;
