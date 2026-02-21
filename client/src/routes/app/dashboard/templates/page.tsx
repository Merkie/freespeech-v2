import {
  createSignal,
  createResource,
  For,
  Show,
  createMemo,
} from 'solid-js';
import type { Component } from 'solid-js';
import Fuse from 'fuse.js';
import api from '@/lib/api';
import type { Template } from '@/lib/types';
import TemplateCard from './_components/TemplateCard';
import SearchBar from '@/routes/app/dashboard/projects/_components/SearchBar';
import { useNavigate } from '@solidjs/router';
import { setEditingTemplate } from '@/lib/state';

const TemplatesPage: Component = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = createSignal('');

  const [templates, { refetch }] = createResource<Template[]>(async () => {
    const response = await api.template.list();
    return response.templates;
  });

  const searchedTemplates = createMemo(() => {
    const query = searchQuery();
    const templateList = templates();

    if (!query || !templateList) return templateList || [];

    const fuse = new Fuse(templateList, {
      keys: ['name'],
    });

    return fuse.search(query).map((result) => result.item);
  });

  const handleEdit = (template: Template) => {
    if (!template.project?.id) {
      console.error('Template has no connected project');
      return;
    }
    // Store template to load after project navigation
    setEditingTemplate(template);
    navigate(`/app/project/${template.project.id}`);
  };

  return (
    <>
      <SearchBar query={searchQuery} setQuery={setSearchQuery} />

      <Show
        when={!templates.loading}
        fallback={<div class="p-8">Loading templates...</div>}
      >
        <Show
          when={searchedTemplates().length > 0}
          fallback={
            <div class="flex flex-col items-center justify-center gap-4 p-8 text-center">
              <i class="bi bi-grid-3x3 text-4xl text-zinc-400" />
              <div class="text-zinc-500">
                <p class="mb-1 font-medium">No templates yet</p>
                <p class="text-sm">
                  Create templates from tile selections in a project
                </p>
              </div>
            </div>
          }
        >
          <div class="m-8 grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-3">
            <For each={searchedTemplates()}>
              {(template) => (
                <TemplateCard
                  template={template}
                  onDelete={() => refetch()}
                  onEdit={() => handleEdit(template)}
                  onRename={() => refetch()}
                />
              )}
            </For>
          </div>
        </Show>
      </Show>
    </>
  );
};

export default TemplatesPage;
