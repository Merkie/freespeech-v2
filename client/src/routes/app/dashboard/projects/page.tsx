import Fuse from 'fuse.js';
import type { Component } from 'solid-js';
import { createMemo, createResource, createSignal, For, onMount, Show } from 'solid-js';
import api from '@/lib/api';
import { MODAL_ID } from '@/lib/constants';
import { setActiveModalId } from '@/lib/state';
import type { Project } from '@/lib/types';
import ProjectCard from '@/routes/app/dashboard/projects/_components/ProjectCard';
import SearchBar from '@/routes/app/dashboard/projects/_components/SearchBar';
import type { SortDirection, SortOption } from '@/routes/app/dashboard/projects/_components/SearchBar';

const ProjectsPage: Component = () => {
	const [searchQuery, setSearchQuery] = createSignal('');
	const [sortBy, setSortBy] = createSignal<SortOption>('updated');
	const [sortDirection, setSortDirection] = createSignal<SortDirection>('desc');

	const [projects, { mutate: mutateProjects }] = createResource<Project[]>(async () => {
		const response = await api.project.list();
		return response.projects;
	});

	const handleToggleFavorite = (projectId: string, newValue: boolean) => {
		mutateProjects((prev) => prev?.map((p) => (p.id === projectId ? { ...p, isFavorite: newValue } : p)));
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

		const sort = sortBy();
		const direction = sortDirection();
		const multiplier = direction === 'asc' ? 1 : -1;

		const compare = (a: Project, b: Project) => {
			if (sort === 'name') {
				return multiplier * a.name.localeCompare(b.name);
			}
			const dateA = new Date(sort === 'created' ? a.createdAt : a.updatedAt).getTime();
			const dateB = new Date(sort === 'created' ? b.createdAt : b.updatedAt).getTime();
			return multiplier * (dateA - dateB);
		};

		return [...projectList].sort((a, b) => {
			const aFav = a.isFavorite;
			const bFav = b.isFavorite;
			if (aFav && !bFav) return -1;
			if (!aFav && bFav) return 1;
			return compare(a, b);
		});
	});

	onMount(() => {
		const projectList = projects();
		if (projectList && projectList.length === 0) {
			setActiveModalId(MODAL_ID.CREATE_PROJECT);
		}
	});

	return (
		<div class="min-h-screen bg-zinc-100">
			<div class="mx-auto max-w-[1500px] px-6 py-8 md:px-12 lg:px-[100px]">
				{/* Search and Sort */}
				<SearchBar query={searchQuery} setQuery={setSearchQuery} sortBy={sortBy} setSortBy={setSortBy} sortDirection={sortDirection} setSortDirection={setSortDirection}>
					<button
						onClick={() => setActiveModalId(MODAL_ID.CREATE_PROJECT)}
						class="flex items-center gap-2 rounded-md bg-blue-500 px-4 py-2 text-white transition-all hover:brightness-110 active:brightness-90"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-5 w-5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
						</svg>
						<span class="text-sm font-semibold uppercase tracking-wider">New Project</span>
					</button>
				</SearchBar>

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
							<Show when={searchQuery()}>
								<div class="flex flex-col items-center justify-center py-16 text-zinc-400">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="mb-4 h-12 w-12 opacity-50"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="2"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
										/>
									</svg>
									<p class="text-lg">No projects found matching "{searchQuery()}"</p>
									<button onClick={() => setSearchQuery('')} class="mt-4 text-sm text-blue-500 hover:text-blue-400">
										Clear search
									</button>
								</div>
							</Show>
						}
					>
						<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
							<For each={sortedProjects()}>{(project) => <ProjectCard project={project} onToggleFavorite={handleToggleFavorite} />}</For>
						</div>
					</Show>
				</Show>
			</div>
		</div>
	);
};

export default ProjectsPage;
