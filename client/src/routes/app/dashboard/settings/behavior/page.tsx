import { A } from '@solidjs/router';
import { createSignal, onMount, type Component } from 'solid-js';
import { clearCache, getCacheStats } from '@/lib/cache';
import { enableSentenceCopyButton, setEnableSentenceCopyButton } from '@/lib/state';

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
			<div class="flex flex-col gap-8">
				<A href="/app/dashboard/settings" class="w-fit p-2 pl-0 text-xl text-zinc-600 hover:text-zinc-800">
					<i class="bi bi-arrow-left-short"></i>
					<span>Back</span>
				</A>

				<p class="border-b border-zinc-300 pb-8 text-4xl text-zinc-600">Behavior Settings</p>
			</div>

			<div class="flex flex-col">
				<div class="flex items-center gap-4">
					<p class="text-3xl text-zinc-800">Display "Copy Sentence" button:</p>
					<button
						aria-label="Toggle copy sentence button"
						onClick={() => setEnableSentenceCopyButton(!enableSentenceCopyButton())}
						class={`relative w-[48px] scale-[120%] rounded-full p-1 shadow-sm transition-all ${
							enableSentenceCopyButton() ? 'bg-green-500' : 'bg-zinc-300'
						}`}
					>
						<div
							style={{
								transform: `translateX(${!enableSentenceCopyButton() ? '0' : '100%'})`,
							}}
							class="h-[20px] w-[20px] rounded-full bg-white shadow-sm transition-all"
						></div>
					</button>
				</div>
			</div>

			<div class="flex flex-col gap-6">
				<p class="text-3xl text-zinc-800">Offline Cache</p>
				<p class="text-xl text-zinc-500">
					Project data is cached on your device for offline use and faster loading.
				</p>

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
