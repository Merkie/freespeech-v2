import Fuse from 'fuse.js';
import type { Component } from 'solid-js';
import { createEffect, createMemo, createResource, createSignal, For, Show } from 'solid-js';
import { globalIsOnline } from '@/hooks/useNetworkStatus';
import api from '@/lib/api';
import { getCachedProjects } from '@/lib/cache/blob-cache';
import { MODAL_ID } from '@/lib/constants';
import { lastVisitedProjectId } from '@/lib/page-actions';
import { setActiveModalId } from '@/lib/state';
import CollaborationInvitations from '@/routes/app/dashboard/projects/_components/CollaborationInvitations';
import ProjectCard from '@/routes/app/dashboard/projects/_components/ProjectCard';
import SearchBar from '@/routes/app/dashboard/projects/_components/SearchBar';

const ProjectsPage: Component = () => {
	const [searchQuery, setSearchQuery] = createSignal('');
	const [showingCached, setShowingCached] = createSignal(false);

	const [projects, { mutate: mutateProjects, refetch: refetchProjects }] = createResource(
		() => (globalIsOnline() ? 'online' : 'offline'),
		async (connection) => {
			if (connection === 'offline') {
				setShowingCached(true);
				return getCachedProjects();
			}

			try {
				const response = await api.project.list();
				setShowingCached(false);
				return response.projects;
			} catch {
				// navigator.onLine can remain true briefly after an iPad wakes with Wi-Fi disabled.
				// A failed/expired request still resolves this resource from IndexedDB instead of
				// leaving the dashboard on a spinner or an empty error state.
				setShowingCached(true);
				return getCachedProjects();
			}
		},
	);

	const handleToggleFavorite = (projectId: string, newValue: boolean) => {
		mutateProjects((prev) => prev?.map((p) => (p.id === projectId ? { ...p, isFavorite: newValue } : p)));
	};

	const handleDelete = (projectId: string) => {
		mutateProjects((prev) => prev?.filter((p) => p.id !== projectId));
	};

	const searchedProjects = createMemo(() => {
		const query = searchQuery();
		const projectList = projects();

		if (!query || !projectList) return projectList || [];

		const fuse = new Fuse(projectList, {
			keys: ['name', 'description'],
		});

		return fuse.search(query).map((result) => result.item);
	});

	const sortedProjects = createMemo(() => {
		const projectList = searchedProjects();
		if (!projectList) return [];
		const lastVisited = lastVisitedProjectId();
		// Last-visited first, like v1, so the SELECTED card always leads the grid. v1 did this with a
		// comparator that only ever returned -1/1/0 for the pinned id and left everything else
		// unordered; the rest fall back to most-recently-updated here instead.
		return [...projectList].sort((a, b) => {
			if (a.id === lastVisited) return -1;
			if (b.id === lastVisited) return 1;
			return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
		});
	});

	let promptedForFirstProject = false;
	createEffect(() => {
		if (projects.loading || showingCached() || promptedForFirstProject) return;
		const projectList = projects();
		if (projectList && projectList.length === 0) {
			promptedForFirstProject = true;
			setActiveModalId(MODAL_ID.CREATE_PROJECT);
		}
	});

	return (
		// Full-bleed like v1: the search bar spans the pane and its bottom border is the divider,
		// so there is no max-width container here.
		<div class="min-h-full bg-zinc-100">
			{/* Search */}
			<SearchBar query={searchQuery} setQuery={setSearchQuery}>
				{/*
					  This sits alongside the search field, so it has to match its 38px height.
					  `leading-none` is what does it: a bootstrap icon is sized by its line box, not
					  its glyph, so a bare `text-base` would contribute 24px and push the whole bar taller — which
					  in turn made the bar's uniform padding look bottom-heavy around the shorter controls.
					  The blue button carries a border it doesn't show for the same reason: without it, it lands
					  2px shorter than the search field.
					*/}
				<button
					type="button"
					onClick={() => setActiveModalId(MODAL_ID.CREATE_PROJECT)}
					disabled={showingCached()}
					class="flex items-center gap-2 rounded-md border border-blue-500 bg-blue-500 px-3 py-2 text-white transition-all hover:brightness-110 active:brightness-90 disabled:cursor-not-allowed disabled:opacity-40"
				>
					<i class="bi bi-plus-lg text-base leading-none" />
					<span class="text-sm font-semibold uppercase tracking-wider">New Project</span>
				</button>
			</SearchBar>

			<Show when={showingCached() && !projects.loading}>
				<div class="mx-8 mt-6 flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
					<i class="bi bi-cloud-slash" />
					<span>
						Offline — showing {projects()?.length ?? 0} {(projects()?.length ?? 0) === 1 ? 'board' : 'boards'} saved on
						this device.
					</span>
				</div>
			</Show>

			<Show when={!showingCached()}>
				<CollaborationInvitations onAccepted={() => void refetchProjects()} />
			</Show>

			{/* Projects Grid */}
			<Show
				when={!projects.loading}
				fallback={
					<div class="flex items-center justify-center py-16 text-zinc-400">
						<div class="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent"></div>
						<span>Loading projects...</span>
					</div>
				}
			>
				<Show
					when={sortedProjects().length > 0}
					fallback={
						<Show
							when={searchQuery()}
							fallback={
								<div class="flex flex-col items-center justify-center py-16 text-center text-zinc-400">
									<i class={`bi ${showingCached() ? 'bi-cloud-slash' : 'bi-grid'} mb-4 text-5xl opacity-50`} />
									<p class="text-lg">{showingCached() ? 'No boards are available offline yet.' : 'No projects yet.'}</p>
									<Show when={showingCached()}>
										<p class="mt-1 max-w-md text-sm">Reconnect and open a board once to save it for offline use.</p>
									</Show>
								</div>
							}
						>
							<div class="flex flex-col items-center justify-center py-16 text-zinc-400">
								<i class="bi bi-search mb-4 text-5xl opacity-50" />
								<p class="text-lg">No projects found matching "{searchQuery()}"</p>
								<button
									type="button"
									onClick={() => setSearchQuery('')}
									class="mt-4 text-sm text-blue-500 hover:text-blue-400"
								>
									Clear search
								</button>
							</div>
						</Show>
					}
				>
					<div class="m-8 grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-3">
						<For each={sortedProjects()}>
							{(project) => (
								<ProjectCard
									project={project}
									onToggleFavorite={handleToggleFavorite}
									onDelete={handleDelete}
									onDuplicate={() => void refetchProjects()}
								/>
							)}
						</For>
					</div>
				</Show>
			</Show>
		</div>
	);
};

export default ProjectsPage;
