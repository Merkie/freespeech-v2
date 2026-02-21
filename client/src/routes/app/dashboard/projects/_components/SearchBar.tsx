import type { Component, JSX, Accessor, Setter } from 'solid-js';
import { createSignal, Show } from 'solid-js';
import useOutsideClick from '@/hooks/useOutsideClick';

interface SearchBarProps {
  query: Accessor<string>;
  setQuery: Setter<string>;
  children?: JSX.Element;
}

type SortOption = 'updated' | 'created' | 'name';
type SortDirection = 'asc' | 'desc';

const SearchBar: Component<SearchBarProps> = (props) => {
  const [sortMenuOpen, setSortMenuOpen] = createSignal(false);
  const [sortMenuRef, setSortMenuRef] = createSignal<HTMLDivElement | undefined>(undefined);

  // Sort state (not implemented yet, just UI)
  const [sortBy, setSortBy] = createSignal<SortOption>('updated');
  const [sortDirection, setSortDirection] = createSignal<SortDirection>('desc');

  useOutsideClick(sortMenuRef, () => {
    if (sortMenuOpen()) setSortMenuOpen(false);
  });

  const handleSortChange = (newSortBy: SortOption) => {
    setSortBy(newSortBy);
    setSortMenuOpen(false);
    // TODO: Implement actual sorting
  };

  const handleSortDirectionChange = (direction: SortDirection) => {
    setSortDirection(direction);
    setSortMenuOpen(false);
    // TODO: Implement actual sorting
  };

  const getSortLabel = () => {
    switch (sortBy()) {
      case 'updated': return 'Updated';
      case 'created': return 'Created';
      case 'name': return 'Name';
    }
  };

  return (
    <div class="mb-6 flex items-center gap-2 rounded-md border border-zinc-300 bg-white p-2">
      {/* Search Input */}
      <div class="relative flex-1">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          value={props.query()}
          onInput={(e) => props.setQuery(e.currentTarget.value)}
          placeholder="Search projects..."
          type="text"
          class="w-full rounded-lg border border-zinc-300 bg-zinc-50 py-2 pl-9 pr-8 text-sm text-zinc-800 placeholder-zinc-400 outline-none transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
        <Show when={props.query()}>
          <button
            onClick={() => props.setQuery('')}
            class="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </Show>
      </div>

      {/* Sort Dropdown */}
      <div ref={setSortMenuRef} class="relative">
        <button
          onClick={() => setSortMenuOpen((prev) => !prev)}
          class="flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-600 transition-all hover:border-zinc-400 hover:text-zinc-800"
        >
          {sortDirection() === 'asc' ? (
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
            </svg>
          )}
          <span class="text-zinc-400">Sort:</span>
          <span>{getSortLabel()}</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class={`h-4 w-4 transition-transform ${sortMenuOpen() ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Sort Menu */}
        <div
          style={{
            'pointer-events': sortMenuOpen() ? 'auto' : 'none',
            opacity: sortMenuOpen() ? 1 : 0,
            top: sortMenuOpen() ? '100%' : 'calc(100% - 5px)',
          }}
          class="absolute right-0 z-20 mt-2 w-48 rounded-md border border-zinc-200 bg-white p-2 shadow-lg transition-all"
        >
          <p class="mb-2 px-2 text-xs font-medium uppercase tracking-wider text-zinc-400">
            Sort by
          </p>
          <button
            onClick={() => handleSortChange('updated')}
            class={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-all hover:bg-zinc-100 ${sortBy() === 'updated' ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-600'}`}
          >
            Last Updated
          </button>
          <button
            onClick={() => handleSortChange('created')}
            class={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-all hover:bg-zinc-100 ${sortBy() === 'created' ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-600'}`}
          >
            Date Created
          </button>
          <button
            onClick={() => handleSortChange('name')}
            class={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-all hover:bg-zinc-100 ${sortBy() === 'name' ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-600'}`}
          >
            Name
          </button>

          <div class="my-2 border-t border-zinc-200" />

          <p class="mb-2 px-2 text-xs font-medium uppercase tracking-wider text-zinc-400">
            Direction
          </p>
          <button
            onClick={() => handleSortDirectionChange('desc')}
            class={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-all hover:bg-zinc-100 ${sortDirection() === 'desc' ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-600'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
            </svg>
            {sortBy() === 'name' ? 'Z to A' : 'Newest First'}
          </button>
          <button
            onClick={() => handleSortDirectionChange('asc')}
            class={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-all hover:bg-zinc-100 ${sortDirection() === 'asc' ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-600'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
            </svg>
            {sortBy() === 'name' ? 'A to Z' : 'Oldest First'}
          </button>
        </div>
      </div>

      {/* Create button slot */}
      {props.children}
    </div>
  );
};

export default SearchBar;
