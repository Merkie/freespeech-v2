import { cn } from '@/lib/cn';
import {
  setActiveModalId,
  project,
  currentPageTemplate,
  setCurrentPageTemplate,
  currentPageId,
  setPageIdBeforeTemplateEdit,
  setEditingTiles,
} from '@/lib/state';
import api from '@/lib/api';
import { createSignal, createResource, For, Show } from 'solid-js';
import { navigateToPageInProject } from '@/lib/page-actions';
import type { Template } from '@/lib/types';
import TemplatePreview from '@/components/TemplatePreview';
import { tooltip } from '@/hooks/useTooltip';

export default function ManageTemplates() {
  const [renamingId, setRenamingId] = createSignal<string | null>(null);
  const [editName, setEditName] = createSignal('');
  const [isSaving, setIsSaving] = createSignal(false);
  const [deletingId, setDeletingId] = createSignal<string | null>(null);
  const [isDeleting, setIsDeleting] = createSignal(false);

  const [templates, { refetch }] = createResource<Template[]>(async () => {
    const projectId = project()?.id;
    if (!projectId) return [];
    const response = await api.template.list({ projectId });
    return response.templates || [];
  });

  const handleView = (template: Template) => {
    // Store current page ID to return to after exiting template edit
    setPageIdBeforeTemplateEdit(currentPageId());
    setActiveModalId('');
    navigateToPageInProject(template.id);
    setEditingTiles(true);
  };

  const startRenaming = (template: Template) => {
    setRenamingId(template.id);
    setEditName(template.name);
  };

  const cancelRenaming = () => {
    setRenamingId(null);
    setEditName('');
  };

  const handleRename = async (template: Template) => {
    const newName = editName().trim();
    if (!newName || newName === template.name || isSaving()) return;

    setIsSaving(true);
    try {
      await api.template.update(template.id, { name: newName });
      // Update currentPageTemplate if it's the one being renamed
      if (currentPageTemplate()?.id === template.id) {
        setCurrentPageTemplate({ ...currentPageTemplate()!, name: newName });
      }
      refetch();
      setRenamingId(null);
    } catch (err) {
      console.error('Failed to rename template:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent, template: Template) => {
    if (e.key === 'Enter') {
      handleRename(template);
    } else if (e.key === 'Escape') {
      cancelRenaming();
    }
  };

  const confirmDelete = async (template: Template) => {
    if (isDeleting()) return;

    setIsDeleting(true);
    try {
      await api.template.delete(template.id);
      // Clear currentPageTemplate if it's the one being deleted
      if (currentPageTemplate()?.id === template.id) {
        setCurrentPageTemplate(null);
      }
      refetch();
      setDeletingId(null);
    } catch (err) {
      console.error('Failed to delete template:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const linkedPagesCount = (template: Template) =>
    template._count?.linkedPages || 0;

  return (
    <div class="flex flex-col gap-4">
      <Show when={templates.loading}>
        <p class="text-zinc-400">Loading templates...</p>
      </Show>

      <Show when={!templates.loading}>
        <div class="max-h-[400px] overflow-y-auto">
          <For each={templates()}>
            {(template, index) => (
              <div
                class={cn('flex items-center gap-3 py-3', {
                  'border-t border-zinc-700': index() !== 0,
                })}
              >
                <TemplatePreview template={template} size="small" />
                <div class="flex-1 min-w-0">
                  <Show
                    when={renamingId() !== template.id}
                    fallback={
                      <div class="flex items-center gap-2">
                        <input
                          type="text"
                          value={editName()}
                          onInput={(e) => setEditName(e.currentTarget.value)}
                          onKeyDown={(e) => handleKeyDown(e, template)}
                          autofocus
                          class="h-7 flex-1 rounded border border-zinc-600 bg-zinc-700 px-2 text-sm text-white outline-none focus:border-blue-500"
                        />
                        <button
                          onClick={() => handleRename(template)}
                          disabled={
                            isSaving() ||
                            !editName().trim() ||
                            editName().trim() === template.name
                          }
                          class="cursor-pointer rounded p-1 text-green-400 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <i class="bi bi-check-lg" />
                        </button>
                        <button
                          onClick={cancelRenaming}
                          class="cursor-pointer rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-700"
                        >
                          <i class="bi bi-x-lg" />
                        </button>
                      </div>
                    }
                  >
                    <p class="truncate text-zinc-200">{template.name}</p>
                    <p class="text-xs text-zinc-500">
                      {template.columns} x {template.rows} &middot;{' '}
                      {linkedPagesCount(template)} page
                      {linkedPagesCount(template) !== 1 ? 's' : ''} linked
                    </p>
                  </Show>
                </div>
                <Show when={renamingId() !== template.id}>
                  <Show
                    when={deletingId() === template.id}
                    fallback={
                      <div class="flex items-center gap-1">
                        <button
                          ref={tooltip('View/Edit')}
                          onClick={() => handleView(template)}
                          class="grid h-8 w-8 cursor-pointer place-items-center rounded text-zinc-400 transition-colors hover:bg-blue-500/10 hover:text-blue-400"
                        >
                          <i class="bi bi-eye" />
                        </button>
                        <button
                          ref={tooltip('Rename')}
                          onClick={() => startRenaming(template)}
                          class="grid h-8 w-8 cursor-pointer place-items-center rounded text-zinc-400 transition-colors hover:bg-yellow-500/10 hover:text-yellow-400"
                        >
                          <i class="bi bi-input-cursor-text" />
                        </button>
                        <button
                          ref={tooltip('Delete')}
                          onClick={() => setDeletingId(template.id)}
                          class="grid h-8 w-8 cursor-pointer place-items-center rounded text-zinc-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
                        >
                          <i class="bi bi-trash" />
                        </button>
                      </div>
                    }
                  >
                    <div class="flex items-center gap-2">
                      <span class="text-sm text-zinc-400">Delete?</span>
                      <button
                        onClick={() => confirmDelete(template)}
                        disabled={isDeleting()}
                        class="cursor-pointer rounded-md bg-red-600 px-3 py-1 text-sm text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isDeleting() ? 'Deleting...' : 'Yes'}
                      </button>
                      <button
                        onClick={() => setDeletingId(null)}
                        disabled={isDeleting()}
                        class="cursor-pointer rounded-md border border-zinc-600 px-3 py-1 text-sm text-zinc-300 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        No
                      </button>
                    </div>
                  </Show>
                </Show>
              </div>
            )}
          </For>
        </div>

        <Show when={!templates.loading && templates()?.length === 0}>
          <div class="flex flex-col items-center gap-2 py-4 text-center">
            <i class="bi bi-grid-3x3 text-2xl text-zinc-500" />
            <p class="text-zinc-400">No templates yet</p>
            <p class="text-sm text-zinc-500">
              Select tiles and use "Create Template" to make one
            </p>
          </div>
        </Show>
      </Show>

      <div class="flex justify-end border-t border-zinc-700 pt-4">
        <button
          onClick={() => setActiveModalId('')}
          class="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-all hover:bg-zinc-700 hover:text-white"
        >
          Close
        </button>
      </div>
    </div>
  );
}
