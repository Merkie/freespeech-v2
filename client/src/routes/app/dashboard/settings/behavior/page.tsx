import { A } from '@solidjs/router';
import { type Component, createSignal, onMount, Show } from 'solid-js';
import { clearCache, getCacheStats } from '@/lib/cache';
import { enableSentenceCopyButton, localSettings, setEnableSentenceCopyButton, setLocalSettings } from '@/lib/state';
import { TILE_IMAGE_FIT_OPTIONS, TILE_TEXT_OVERFLOW_OPTIONS, TILE_TEXT_SIZE_OPTIONS } from '@/lib/tile-appearance';
import type { LocalSettings } from '@/lib/types';
import OfflineSettingsNotice from '../_components/OfflineSettingsNotice';
import { SegmentedControl, SettingRow, Toggle } from '../_components/SettingControls';

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const BehaviorSettingsPage: Component = () => {
	const [cacheUsed, setCacheUsed] = createSignal(0);
	const [cacheMax, setCacheMax] = createSignal(0);
	const [cacheEntries, setCacheEntries] = createSignal(0);
	const [clearing, setClearing] = createSignal(false);

	// localSettings is stored as one object, so every setter merges rather than replaces.
	const update = <K extends keyof LocalSettings>(key: K, value: LocalSettings[K]) =>
		setLocalSettings({ ...localSettings(), [key]: value });

	async function loadCacheStats() {
		const stats = await getCacheStats();
		setCacheUsed(stats.usedBytes);
		setCacheMax(stats.maxBytes);
		setCacheEntries(stats.entryCount);
	}

	onMount(() => {
		loadCacheStats();
	});

	async function handleClearCache() {
		setClearing(true);
		await clearCache();
		await loadCacheStats();
		setClearing(false);
	}

	const usagePercent = () => {
		if (cacheMax() === 0) return 0;
		return Math.min((cacheUsed() / cacheMax()) * 100, 100);
	};

	return (
		<div class="flex flex-col gap-12 p-8 pb-[200px]">
			<OfflineSettingsNotice />
			<div class="flex flex-col gap-8">
				<A href="/app/dashboard/settings" class="w-fit p-2 pl-0 text-xl text-zinc-600 hover:text-zinc-800">
					<i class="bi bi-arrow-left-short"></i>
					<span>Back</span>
				</A>

				<p class="border-b border-zinc-300 pb-8 text-4xl text-zinc-600">Behavior Settings</p>
			</div>

			<div class="flex flex-col gap-8">
				<SettingRow
					title="Sentence builder"
					description="When off, tapping a tile speaks it straight away and nothing is queued. The sentence bar and its buttons are hidden, leaving more room for tiles."
				>
					<Toggle
						checked={localSettings().sentenceBuilder}
						onChange={(next) => update('sentenceBuilder', next)}
						label="Toggle sentence builder"
					/>
				</SettingRow>

				{/* The copy button lives inside the sentence bar, so it is meaningless without it. */}
				<Show when={localSettings().sentenceBuilder}>
					<SettingRow
						title={'Display "Copy Sentence" button'}
						description="Adds a button to the sentence bar that copies the current sentence to the clipboard."
					>
						<Toggle
							checked={enableSentenceCopyButton()}
							onChange={setEnableSentenceCopyButton}
							label="Toggle copy sentence button"
						/>
					</SettingRow>
				</Show>

				<SettingRow
					title="Speak on tap"
					description="Speak each tile as it is tapped, in addition to adding it to the sentence."
				>
					<Toggle
						checked={localSettings().speakOnTap}
						onChange={(next) => update('speakOnTap', next)}
						label="Toggle speak on tap"
					/>
				</SettingRow>

				<SettingRow
					title="Search for images online"
					description="When off, tile images can only come from this device. Nothing is sent to an image search provider."
				>
					<Toggle
						checked={localSettings().webImageSearch}
						onChange={(next) => update('webImageSearch', next)}
						label="Toggle online image search"
					/>
				</SettingRow>

				<SettingRow title="Tile text size" description="How large the label on each tile is drawn.">
					<SegmentedControl
						value={localSettings().tileTextSize}
						options={TILE_TEXT_SIZE_OPTIONS}
						onChange={(next) => update('tileTextSize', next)}
						label="Tile text size"
						name="tileTextSize"
					/>
				</SettingRow>

				<SettingRow
					title="Long tile text"
					description="Truncate cuts a long label off with an ellipsis. Word wrap lets it run onto more lines, which leaves less room for the tile's image — especially at larger text sizes."
				>
					<SegmentedControl
						value={localSettings().tileTextOverflow}
						options={TILE_TEXT_OVERFLOW_OPTIONS}
						onChange={(next) => update('tileTextOverflow', next)}
						label="Long tile text"
						name="tileTextOverflow"
					/>
				</SettingRow>

				<SettingRow
					title="Tile image fit"
					description="Contain shows the whole image, which suits symbol sets. Cover fills the tile and crops the edges, which usually suits photographs."
				>
					<SegmentedControl
						value={localSettings().tileImageFit}
						options={TILE_IMAGE_FIT_OPTIONS}
						onChange={(next) => update('tileImageFit', next)}
						label="Tile image fit"
						name="tileImageFit"
					/>
				</SettingRow>
			</div>

			<div class="flex flex-col gap-6">
				<p class="text-3xl text-zinc-800">Offline Cache</p>
				<p class="text-xl text-zinc-500">Project data is cached on your device for offline use and faster loading.</p>

				<div class="flex flex-col gap-3">
					<div class="flex items-baseline justify-between">
						<p class="text-lg text-zinc-600">
							{formatBytes(cacheUsed())} of {formatBytes(cacheMax())} used
						</p>
						<p class="text-lg text-zinc-500">
							{cacheEntries()} {cacheEntries() === 1 ? 'project' : 'projects'} cached
						</p>
					</div>

					<div class="h-3 w-full overflow-hidden rounded-full bg-zinc-200">
						<div
							class={`h-full rounded-full transition-all ${usagePercent() > 80 ? 'bg-red-400' : 'bg-pink-400'}`}
							style={{ width: `${usagePercent()}%` }}
						></div>
					</div>
				</div>

				<button
					type="button"
					onClick={handleClearCache}
					disabled={clearing() || cacheEntries() === 0}
					class="w-fit rounded-lg border-2 border-red-200 bg-red-50 px-5 py-3 text-xl text-red-600 transition-all hover:border-red-300 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{clearing() ? 'Clearing...' : 'Clear Cache'}
				</button>
			</div>
		</div>
	);
};

export default BehaviorSettingsPage;
