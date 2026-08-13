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
		<div
			ref={setCardRef}
			class="relative flex h-fit w-full flex-col gap-4 rounded-lg border border-zinc-300 bg-zinc-200 p-2 shadow-sm"
			classList={{
				'border-blue-200 ring-4 ring-blue-200 ring-offset-2 ring-offset-zinc-100': selected(),
			}}
		>
			{/*
			  A stretched link behind the content rather than one big <A> around it: a button nested
			  inside a link is invalid markup, and the footer now holds a real ⋯ button. Interactive
			  children sit above the link on their own z layer.
			*/}
			<A href={projectUrl()} aria-label={`Open ${props.project.name}`} class="absolute inset-0 z-[1] rounded-lg" />

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
				<Show when={isFavorite()}>
					<i class="bi bi-star-fill shrink-0 text-base leading-none text-amber-400" />
				</Show>
				<p class="min-w-0 truncate whitespace-nowrap">
					{props.project.name}
					<Show when={selected()}>
						<span class="sr-only"> (selected)</span>
					</Show>
				</p>
				{/*
				  One badge recipe: every signal is the same 22px pill, filled with its hue at 12% so
				  the tint composites over the zinc shell instead of clashing with it. Sharing one
				  height is also what aligns the row geometrically — no optical nudges needed.
				*/}
				<div class="ml-auto flex shrink-0 items-center gap-1.5">
					<Show when={isShared()}>
						<span
							title={`Shared by ${props.project.owner?.name ?? 'another FreeSpeech user'}`}
							class="flex h-[22px] items-center gap-1 rounded-full bg-sky-500/[12%] px-2 text-xs font-semibold text-sky-700"
						>
							<i class="bi bi-people-fill leading-none" />
							Shared
						</span>
					</Show>
					<Show when={cached()}>
						<span
							title="Saved on this device for offline use"
							class="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-zinc-500/[12%] text-zinc-500"
						>
							<i class="bi bi-cloud-check-fill text-xs leading-none" />
						</span>
					</Show>
					<button
						type="button"
						onClick={handleMenuClick}
						aria-label={`Options for ${props.project.name}`}
						class="relative z-[2] flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-all hover:bg-zinc-500/[12%] hover:text-zinc-800"
					>
						<i class="bi bi-three-dots text-base leading-none" />
					</button>
				</div>
			</div>

			<Show when={selected()}>
				{/*
				  Selection lives on the frame: the ring is the signal and this corner check labels it,
				  like a file picker. Its own zinc ring matches the dashboard ground so it reads as
				  punched through the card corner. pointer-events-none keeps it from masking the link
				  beneath; the sr-only text on the name carries the state for screen readers.
				*/}
				<div
					aria-hidden="true"
					class="pointer-events-none absolute -left-2 -top-2 z-[2] flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-white ring-[3px] ring-zinc-100"
				>
					<i class="bi bi-check-lg text-sm leading-none" />
				</div>
			</Show>

			{/* Context Menu — opens upward from the footer trigger */}
			<div
				style={{
					'pointer-events': menuOpen() ? 'auto' : 'none',
					opacity: menuOpen() ? 1 : 0,
					'user-select': 'none',
					// Clears the trigger, whose top sits 36px up: the card's p-2 (8px) plus its h-7 (28px).
					bottom: menuOpen() ? '44px' : '38px',
				}}
				class="absolute right-2 z-10 flex w-fit flex-col whitespace-nowrap rounded-md border border-zinc-200 bg-white p-2 text-sm shadow-lg transition-all"
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
