import { cn } from '@/lib/cn';
import {
  setActiveModalId,
  pageBeingEdited,
  setPageBeingEdited,
  project,
  setProjectPages,
} from '@/lib/state';
import { MODAL_ID } from '@/lib/constants';
import api from '@/lib/api';
import { createSignal, Show } from 'solid-js';

export default function EditPage() {
  const page = pageBeingEdited();
  const [name, setName] = createSignal(page?.name || '');
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal('');

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    const pageId = page?.id;
    const projectId = project()?.id;
    if (isLoading() || !name().trim() || !pageId || !projectId) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await api.page.edit(pageId, {
        name: name().trim(),
      });

      if (response.error) {
        setError(response.error);
        setIsLoading(false);
        return;
      }

      // Refresh the pages list
      const { pages } = await api.project.listPages(projectId);
      setProjectPages(pages);

      // Clear the page being edited and go back to manage pages
      setPageBeingEdited(null);
      setActiveModalId(MODAL_ID.MANAGE_PAGES);
    } catch (err) {
      setError('Failed to update page');
      setIsLoading(false);
    }
  };

  const isValid = () => name().trim().length > 0;

  return (
    <form onSubmit={handleSubmit} class="flex flex-col gap-4">
      <div>
        <label class="mb-2 block text-sm font-medium text-zinc-300">
          Page Name
        </label>
        <input
          type="text"
          value={name()}
          onInput={(e) => setName(e.currentTarget.value)}
          placeholder="Page name"
          class="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-sm text-white placeholder-zinc-500 outline-none transition-colors focus:border-blue-500"
          autofocus
        />
      </div>

      <Show when={error()}>
        <p class="text-sm text-red-400">{error()}</p>
      </Show>

      <div class="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={() => {
            setPageBeingEdited(null);
            setActiveModalId(MODAL_ID.MANAGE_PAGES);
          }}
          class="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-all hover:bg-zinc-700 hover:text-white"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={!isValid() || isLoading()}
          class={cn(
            'rounded-lg border px-4 py-2 text-sm font-medium transition-all',
            {
              'border-blue-500 bg-blue-600 text-white hover:bg-blue-500':
                isValid() && !isLoading(),
              'cursor-not-allowed border-zinc-700 bg-zinc-800 text-zinc-500':
                !isValid() || isLoading(),
            }
          )}
        >
          {isLoading() ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}
