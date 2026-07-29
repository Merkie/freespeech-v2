import type { Accessor, Component, JSX, Setter } from 'solid-js';

interface SearchBarProps {
	query: Accessor<string>;
	setQuery: Setter<string>;
	children?: JSX.Element;
}

const SearchBar: Component<SearchBarProps> = (props) => {
	return (
		<div class="mb-2 flex items-center gap-2 border-b border-zinc-300 p-2">
			<div class="flex flex-1 items-center gap-2 rounded-md border border-zinc-300 bg-zinc-200 p-1 px-4 text-sm">
				<i class="bi bi-search" />
				<input
					value={props.query()}
					onInput={(e) => props.setQuery(e.currentTarget.value)}
					placeholder="Search..."
					type="text"
					class="flex-1 bg-transparent p-1 outline-none"
				/>
			</div>
			{props.children}
		</div>
	);
};

export default SearchBar;
