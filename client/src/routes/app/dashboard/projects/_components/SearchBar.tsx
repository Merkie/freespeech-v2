import type { Accessor, Component, JSX, Setter } from 'solid-js';
import { Show } from 'solid-js';

interface SearchBarProps {
	query: Accessor<string>;
	setQuery: Setter<string>;
	children?: JSX.Element;
}

const SearchBar: Component<SearchBarProps> = (props) => {
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
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-4 w-4"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</Show>
			</div>

			{/* Create button slot */}
			{props.children}
		</div>
	);
};

export default SearchBar;
