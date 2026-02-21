import {
  currentPage,
  editingTiles,
  setEditingTiles,
  localSettings,
  projectLoading,
  pageLoading,
  resetProjectState,
  editingTemplate,
  setEditingTemplate,
} from '@/lib/state';
import type { Project } from '@/lib/types';
import { useNavigate, useParams } from '@solidjs/router';
import { createEffect, on, Show, type Component } from 'solid-js';
import ProjectHeader from './_components/ProjectHeader';
import SentenceBuilder from './_components/SentenceBuilder';
import ProjectContent from './_components/ProjectContent';
import ProjectContentSkeleton from './_components/ProjectContentSkeleton';
import { loadProject, navigateToPageInProject } from '@/lib/page-actions';

const AppProjectPage: Component = () => {
  const params = useParams();
  const navigate = useNavigate();

  // React to route param changes
  createEffect(
    on(
      () => params.project_id,
      async (projectId, prevProjectId) => {
        // Skip if same project
        if (projectId === prevProjectId) return;

        // Reset state when switching from one project to another
        if (prevProjectId) {
          resetProjectState();
        }

        // Check if we're navigating to edit a specific template
        const templateToEdit = editingTemplate();

        const success = await loadProject(projectId, { setHomePage: !templateToEdit });
        if (!success) {
          navigate('/app/dashboard/projects');
          return;
        }

        // If editing a template, navigate to it and enter edit mode
        if (templateToEdit) {
          await navigateToPageInProject(templateToEdit.id);
          setEditingTiles(true);
          setEditingTemplate(null); // Clear after use
        }
      },
      { defer: false }
    )
  );

  // Show skeleton while loading or when no page is loaded
  const isLoading = () => projectLoading() || pageLoading() || !currentPage();

  return (
    <>
      <ProjectHeader />
      {/* Hide sentence builder when in edit mode (matches Svelte behavior) */}
      <Show when={!editingTiles() && localSettings().sentenceBuilder}>
        <SentenceBuilder />
      </Show>
      <Show fallback={<ProjectContentSkeleton />} when={!isLoading()}>
        <ProjectContent />
      </Show>
    </>
  );
};

// This finds the page named "home" or the first page if "home" doesn't exist
export function getHomePageId(project: Project): string {
  return (
    project.homePageId ||
    ((
      project.connectedPages?.find(
        ({ tilePage }) => tilePage?.name.toLowerCase().trim() === 'home'
      ) ?? project.connectedPages?.[0]
    )?.tilePageId ??
      '')
  );
}

export default AppProjectPage;
