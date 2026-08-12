import { type Component, createSignal, onMount, Show } from 'solid-js';
import { clearCache, getCacheStats } from '@/lib/cache';
import { cn } from '@/lib/cn';
import { enableSentenceCopyButton, localSettings, setEnableSentenceCopyButton, setLocalSettings } from '@/lib/state';
import type { LocalSettings } from '@/lib/types';
import { SettingButton, SettingCard, SettingRow, SettingsPageLayout, Toggle } from '../_components/SettingControls';
import { SETTINGS_SECTIONS } from '../_components/settings-sections';

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
		<SettingsPageLayout section={SETTINGS_SECTIONS.behavior}>
			<SettingCard>
				<div class="divide-y divide-zinc-100">
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
				</div>
			</SettingCard>

			<SettingCard>
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
			</SettingCard>

			<SettingCard>
				<SettingRow
					layout="stacked"
					title="Offline cache"
					description="Project data is cached on this device for offline use and faster loading."
				>
					<div class="flex flex-col gap-5">
						<div class="flex flex-col gap-3">
							<div class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
								<p class="text-lg text-zinc-600">
									{formatBytes(cacheUsed())} of {formatBytes(cacheMax())} used
								</p>
								<p class="text-lg text-zinc-500">
									{cacheEntries()} {cacheEntries() === 1 ? 'project' : 'projects'} cached
								</p>
							</div>

							<div class="h-3 w-full overflow-hidden rounded-full bg-zinc-200">
								<div
									class={cn('h-full rounded-full transition-all', usagePercent() > 80 ? 'bg-red-400' : 'bg-blue-500')}
									style={{ width: `${usagePercent()}%` }}
								></div>
							</div>
						</div>

						<SettingButton variant="danger" onClick={handleClearCache} disabled={clearing() || cacheEntries() === 0}>
							{clearing() ? 'Clearing…' : 'Clear cache'}
						</SettingButton>
					</div>
				</SettingRow>
			</SettingCard>
		</SettingsPageLayout>
	);
};

export default BehaviorSettingsPage;
