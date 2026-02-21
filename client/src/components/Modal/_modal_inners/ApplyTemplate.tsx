import { cn } from '@/lib/cn';
import {
  setActiveModalId,
  project,
  currentPage,
  setCurrentPageTemplate,
  setCurrentPageTemplateTiles,
} from '@/lib/state';
import api from '@/lib/api';
import { createSignal, createResource, Show, For, createMemo } from 'solid-js';
import TemplatePreview from '@/components/TemplatePreview';

export default function ApplyTemplate() {
  const [searchQuery, setSearchQuery] = createSignal('');
  const [selectedTemplateId, setSelectedTemplateId] = createSignal<string | null>(null);
  const [isApplying, setIsApplying] = createSignal(false);
  const [error, setError] = createSignal('');

  const currentProject = () => project();
  const currentPageData = () => currentPage();

  // Fetch templates for the current project
  const [templates] = createResource(
    () => currentProject()?.id,
    async (projectId) => {
      if (!projectId) return [];
      const response = await api.template.list({ projectId });
      return response.templates || [];
    }
  );

  // Filter templates by search
  const filteredTemplates = createMemo(() => {
    const allTemplates = templates() || [];
    const query = searchQuery().toLowerCase();

    return allTemplates.filter((template) => {
      if (!query) return true;
      return template.name.toLowerCase().includes(query);
    });
  });

  const handleApply = async () => {
    const templateId = selectedTemplateId();
    const pageId = currentPageData()?.tilePageId;
    if (!templateId || !pageId || isApplying()) return;

    setIsApplying(true);
    setError('');

    try {
      const response = await api.page.linkTemplate(pageId, templateId);

      if ('error' in response) {
        setError(response.error as string);
        setIsApplying(false);
        return;
      }

      // Update current page template state
      if (response.template) {
        setCurrentPageTemplate(response.template);
        setCurrentPageTemplateTiles(response.template.tiles || []);
      }

      setActiveModalId('');
    } catch (err) {
      setError('Failed to apply template');
      setIsApplying(false);
    }
  };

  return (
    <div class="flex flex-col gap-4">
      {/* Search input */}
      <div>
        <input
          type="text"
          value={searchQuery()}
          onInput={(e) => setSearchQuery(e.currentTarget.value)}
          placeholder="Search templates..."
          class="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-sm text-white placeholder-zinc-500 outline-none transition-colors focus:border-blue-500"
          autofocus
        />
      </div>

      {/* Templates list */}
      <div class="max-h-64 overflow-y-auto">
        <Show
          when={!templates.loading}
          fallback={
            <div class="py-4 text-center text-sm text-zinc-400">
              Loading templates...
            </div>
          }
        >
          <Show
            when={filteredTemplates().length > 0}
            fallback={
              <div class="py-4 text-center text-sm text-zinc-400">
                No templates found for this project
              </div>
            }
          >
            <div class="flex flex-col gap-2">
              <For each={filteredTemplates()}>
                {(template) => (
                  <button
                    type="button"
                    onClick={() => setSelectedTemplateId(template.id)}
                    class={cn(
                      'flex items-center gap-3 rounded-lg border p-3 text-left transition-all',
                      {
                        'border-blue-500 bg-blue-500/10':
                          selectedTemplateId() === template.id,
                        'border-zinc-700 bg-zinc-800 hover:border-zinc-600':
                          selectedTemplateId() !== template.id,
                      }
                    )}
                  >
                    <TemplatePreview template={template} size="small" />
                    <div class="flex-1">
                      <div class="text-sm font-medium text-white">
                        {template.name}
                      </div>
                      <div class="text-xs text-zinc-400">
                        {template._count && (
                          <span>
                            {template._count.linkedPages} page
                            {template._count.linkedPages !== 1 ? 's' : ''} linked
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )}
              </For>
            </div>
          </Show>
        </Show>
      </div>

      <Show when={error()}>
        <p class="text-sm text-red-400">{error()}</p>
      </Show>

      <div class="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={() => setActiveModalId('')}
          class="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-all hover:bg-zinc-700 hover:text-white"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleApply}
          disabled={!selectedTemplateId() || isApplying()}
          class={cn(
            'rounded-lg border px-4 py-2 text-sm font-medium transition-all',
            {
              'border-blue-500 bg-blue-600 text-white hover:bg-blue-500':
                selectedTemplateId() && !isApplying(),
              'cursor-not-allowed border-zinc-700 bg-zinc-800 text-zinc-500':
                !selectedTemplateId() || isApplying(),
            }
          )}
        >
          {isApplying() ? 'Applying...' : 'Apply Template'}
        </button>
      </div>
    </div>
  );
}
