import { type Component, createEffect, createSignal, For, Show } from 'solid-js';
import api from '@/lib/api';
import { OfflineError } from '@/lib/api/util';
import { blobUpdateTile } from '@/lib/blob-actions';
import { cn } from '@/lib/cn';
import { type SkinTone, SkinTones } from '@/lib/opensymbols';
import { uploadBlob } from '@/lib/presigned-uploads';
import {
	currentPageId,
	editingTilePositions,
	findTileByPositionKey,
	getCurrentPageTiles,
	localSettings,
	setLoading,
	setLocalSettings,
	setUsingOnlineSearch,
} from '@/lib/state';
import { showToast } from '@/lib/toast';

type SearchResult = {
	image_url: string;
	thumbnail_url: string;
	alt: string;
};

interface OnlineImageSearchPanelProps {
	height: number;
}

const OnlineImageSearchPanel: Component<OnlineImageSearchPanelProps> = (props) => {
	// Get the first selected tile's text for initial search term
	const getFirstSelectedTileText = () => {
		const positions = editingTilePositions();
		if (positions.length === 0) return '';
		const tiles = getCurrentPageTiles();
		const tile = findTileByPositionKey(tiles, positions[0]);
		return tile?.text ?? '';
	};

	const [searchTerm, setSearchTerm] = createSignal(getFirstSelectedTileText());
	const [searchResults, setSearchResults] = createSignal<SearchResult[]>([]);
	const [searching, setSearching] = createSignal(false);
	const [imagesReady, setImagesReady] = createSignal(false);
	const [searchStrategy, setSearchStrategy] = createSignal<'google' | 'open-symbols'>('google');

	const selectedSkinTone = () => (localSettings().skinTone || 'medium') as SkinTone;

	const preloadImages = (images: SearchResult[]): Promise<SearchResult[]> => {
		if (images.length === 0) return Promise.resolve([]);

		return new Promise((resolve) => {
			let loadedCount = 0;
			const totalImages = images.length;
			const validImages: SearchResult[] = [];

			images.forEach((image) => {
				const img = new Image();
				img.onload = () => {
					validImages.push(image);
					loadedCount++;
					if (loadedCount >= totalImages) {
						resolve(validImages);
					}
				};
				img.onerror = () => {
					loadedCount++;
					if (loadedCount >= totalImages) {
						resolve(validImages);
					}
				};
				img.src = image.thumbnail_url;
			});
		});
	};

	const handleUploadFromInternet = async (url: string) => {
		const positions = editingTilePositions();
		if (positions.length === 0) return;

		const tiles = getCurrentPageTiles();
		const tile = findTileByPositionKey(tiles, positions[0]);
		if (!tile) return;

		const filename = `${url.split('/').pop()}`;

		try {
			const blob = await api.media.fetchFromUrl(url);

			setLoading(true);
			const key = await uploadBlob(filename, blob);
			setLoading(false);

			if (key) {
				setUsingOnlineSearch(false);
				blobUpdateTile(
					currentPageId(),
					{ x: tile.x, y: tile.y, page: tile.page },
					{ image: `https://media.freespeechaac.com/${key}` },
				);
			}
		} catch (err) {
			setLoading(false);
			if (err instanceof OfflineError) {
				showToast('This requires an internet connection', 'error');
			} else {
				showToast('Failed to upload image', 'error');
			}
		}
	};

	const searchImages = async () => {
		setSearching(true);
		setImagesReady(false);
		setSearchResults([]);

		try {
			let images: SearchResult[] = [];
			if (searchStrategy() === 'google') {
				const response = await api.media.searchImages.google({
					query: searchTerm(),
					skinColor: selectedSkinTone(),
				});
				if (response.results) images = response.results;
			} else {
				const response = await api.media.searchImages.openSymbols({
					query: searchTerm(),
					skinColor: selectedSkinTone(),
				});
				if (response.results) images = response.results;
			}

			if (images.length > 0) {
				const validImages = await preloadImages(images);
				setSearchResults(validImages);
			}

			setImagesReady(true);
		} catch (err) {
			if (err instanceof OfflineError) {
				showToast('This requires an internet connection', 'error');
			} else {
				showToast('Image search failed', 'error');
			}
		} finally {
			setSearching(false);
		}
	};

	// Auto-refresh when skin tone changes (only for Open Symbols)
	let previousSkinTone = selectedSkinTone();
	createEffect(() => {
		const currentSkinTone = selectedSkinTone();
		if (currentSkinTone !== previousSkinTone) {
			previousSkinTone = currentSkinTone;
			if (searchStrategy() === 'open-symbols' && searchResults().length > 0) {
				searchImages();
			}
		}
	});

	const handleKeyDown = (e: KeyboardEvent) => {
		if (e.key === 'Enter' && !searching()) {
			searchImages();
		}
	};

	const handleStrategyChange = (strategy: 'google' | 'open-symbols') => {
		setSearchStrategy(strategy);
		setSearchResults([]);
		setImagesReady(false);
	};

	const handleSkinToneSelect = (skinTone: SkinTone) => {
		setLocalSettings({ ...localSettings(), skinTone });
	};

	return (
		<div
			class="flex w-[350px] flex-col overflow-y-auto border border-zinc-800 bg-zinc-900 p-4 text-zinc-200 shadow-md"
			style={{ height: `${props.height}px` }}
		>
			<button
				onClick={() => setUsingOnlineSearch(false)}
				class="mb-2 flex items-center gap-1 text-sm text-zinc-300 hover:text-white"
			>
				<i class="bi bi-arrow-left" />
				Back
			</button>

			{/* Search strategy tabs */}
			<div class="flex gap-4 py-4">
				<button
					onClick={() => handleStrategyChange('google')}
					class={cn('hover:text-white', {
						'underline text-white': searchStrategy() === 'google',
						'text-zinc-400': searchStrategy() !== 'google',
					})}
				>
					<i class="bi bi-google mr-1" />
					<span>Google Images</span>
				</button>
				<button
					onClick={() => handleStrategyChange('open-symbols')}
					class={cn('hover:text-white', {
						'underline text-white': searchStrategy() === 'open-symbols',
						'text-zinc-400': searchStrategy() !== 'open-symbols',
					})}
				>
					Open Symbols
				</button>
			</div>

			{/* Skin tone picker (only for Open Symbols) */}
			<Show when={searchStrategy() === 'open-symbols'}>
				<div class="flex items-center gap-1 pb-4">
					<p class="pr-3">Skin tone:</p>
					<For each={SkinTones}>
						{(skinTone) => (
							<button
								onClick={() => handleSkinToneSelect(skinTone.name)}
								class={cn('h-[40px] flex-1 rounded-sm transition-all', {
									'scale-90 ring-2 ring-white ring-offset-2 ring-offset-zinc-900': selectedSkinTone() === skinTone.name,
								})}
								style={{ 'background-color': skinTone.pigmentHexValue }}
							/>
						)}
					</For>
				</div>
			</Show>

			{/* Search input */}
			<div class="mb-2 flex items-center gap-2">
				<div class="flex flex-1 items-center gap-1 rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-800">
					<i class="bi bi-search" />
					<input
						type="text"
						value={searchTerm()}
						onInput={(e) => setSearchTerm(e.currentTarget.value)}
						onKeyDown={handleKeyDown}
						placeholder={
							searchStrategy() === 'google' ? 'Search for images online...' : 'Search for symbols on Open Symbols...'
						}
						class="w-full rounded-md border-none p-1 px-2 outline-none"
					/>
				</div>
				<button
					onClick={searchImages}
					disabled={searching()}
					class="rounded-md border border-blue-500 bg-blue-600 p-1 px-4 text-sm disabled:cursor-not-allowed disabled:opacity-50"
				>
					{searching() ? 'Searching...' : 'Search'}
				</button>
			</div>

			{/* Loading state */}
			<Show when={searching()}>
				<div class="mt-8 flex flex-col items-center justify-center gap-3">
					<div class="h-8 w-8 animate-spin rounded-full border-4 border-zinc-600 border-t-blue-500" />
					<p class="text-center text-zinc-300">Searching for images...</p>
					<p class="text-center text-xs text-zinc-500">This may take a few seconds</p>
				</div>
			</Show>

			{/* Empty state */}
			<Show when={!searching() && imagesReady() && searchResults().length === 0}>
				<p class="mt-8 text-center text-zinc-300">No results found</p>
			</Show>

			{/* Search results */}
			<Show when={imagesReady() && searchResults().length > 0}>
				<div class="mt-2 flex-1 overflow-y-auto">
					<div class="columns-2 gap-4">
						<For each={searchResults()}>
							{(image) => (
								<button
									disabled={searching()}
									onClick={() => handleUploadFromInternet(image.image_url)}
									class="mb-4 w-full hover:opacity-80"
								>
									<img class="mx-auto rounded" src={image.thumbnail_url} alt={image.alt} loading="lazy" />
								</button>
							)}
						</For>
					</div>
				</div>
			</Show>
		</div>
	);
};

export default OnlineImageSearchPanel;
