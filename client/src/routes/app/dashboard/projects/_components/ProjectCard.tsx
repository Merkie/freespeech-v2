import { A } from '@solidjs/router';
import type { Component } from 'solid-js';
import { Show, createSignal } from 'solid-js';
import type { Project } from '@/lib/types';
import { project, setActiveModalId, setProjectToOptimize } from '@/lib/state';
import { MODAL_ID } from '@/lib/constants';
import useOutsideClick from '@/hooks/useOutsideClick';

interface ProjectCardProps {
  project: Project;
}

const ProjectCard: Component<ProjectCardProps> = (props) => {
  const selected = () => project()?.id === props.project.id;
  const [menuOpen, setMenuOpen] = createSignal(false);
  const [cardRef, setCardRef] = createSignal<HTMLDivElement | undefined>(undefined);

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

  const handleDelete = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen(false);
    // TODO: Implement delete functionality
  };

  const getTimeAgo = () => {
    const updatedAt = props.project.updatedAt;
    if (!updatedAt) return '';

    const date = new Date(updatedAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffDays > 30) {
      const diffMonths = Math.floor(diffDays / 30);
      return `Updated ${diffMonths} ${diffMonths === 1 ? 'month' : 'months'} ago`;
    } else if (diffDays > 0) {
      return `Updated ${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    } else if (diffHours > 0) {
      return `Updated ${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    } else if (diffMinutes > 0) {
      return `Updated ${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`;
    } else {
      return 'Updated just now';
    }
  };

  return (
    <div ref={setCardRef} class="group relative flex flex-col">
      <div class="relative rounded-md border border-zinc-200 bg-white p-4 text-left shadow-sm transition-all hover:border-zinc-300 hover:shadow-md">
        {/* Header with title and menu */}
        <div class="flex items-center">
          <div class="flex flex-1 items-center gap-2 truncate">
            <A
              href={projectUrl()}
              class="flex-1 truncate text-left text-xl font-medium text-zinc-800"
            >
              {props.project.name}
            </A>
            <button
              onClick={handleMenuClick}
              class="flex shrink-0 cursor-pointer items-center justify-center text-lg text-zinc-400 transition-all hover:text-zinc-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="5" r="1" fill="currentColor" />
                <circle cx="12" cy="12" r="1" fill="currentColor" />
                <circle cx="12" cy="19" r="1" fill="currentColor" />
              </svg>
            </button>
          </div>
        </div>

        {/* Thumbnail */}
        <A
          href={projectUrl()}
          style={{
            'background-image': `url(${import.meta.env.VITE_R2_URL}${props.project.imageUrl})`,
            'background-size': 'cover',
            'background-position': 'center',
          }}
          class="my-4 block h-[220px] w-full rounded-md bg-zinc-200"
        />

        {/* Footer with time and selected badge */}
        <div class="flex items-center justify-between">
          <p class="text-sm font-light text-zinc-500">
            {getTimeAgo()}
          </p>
          <Show when={selected()}>
            <div class="rounded-md bg-blue-500 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-white">
              Selected
            </div>
          </Show>
        </div>
      </div>

      {/* Context Menu */}
      <div
        style={{
          'pointer-events': menuOpen() ? 'auto' : 'none',
          opacity: menuOpen() ? 1 : 0,
          'user-select': 'none',
          top: menuOpen() ? '40px' : '35px',
        }}
        class="absolute right-4 z-10 flex w-fit flex-col whitespace-nowrap rounded-md border border-zinc-200 bg-white p-2 text-sm shadow-lg transition-all"
      >
        <button
          onClick={handleRename}
          class="flex items-center gap-2 rounded-md p-1 px-2 text-left text-zinc-700 transition-all hover:bg-zinc-100"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Rename
        </button>
        <button
          onClick={handleDuplicate}
          class="flex items-center gap-2 rounded-md p-1 px-2 text-left text-zinc-700 transition-all hover:bg-zinc-100"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Duplicate
        </button>
        <button
          onClick={handleOptimizeImages}
          class="flex items-center gap-2 rounded-md p-1 px-2 text-left text-zinc-700 transition-all hover:bg-zinc-100"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Optimize Images
        </button>

        <div class="my-2 border-t border-zinc-200" />

        <button
          onClick={handleDelete}
          class="flex items-center gap-2 rounded-md p-1 px-2 text-left text-red-500 transition-all hover:bg-red-50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Delete
        </button>
      </div>
    </div>
  );
};

export default ProjectCard;
