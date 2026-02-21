import { createSignal, Match, onMount, Show, Switch } from 'solid-js';
import api from '@/lib/api';
import { projectToOptimize, setActiveModalId } from '@/lib/state';

type Phase = 'loading' | 'confirm' | 'processing' | 'complete' | 'error';

function formatBytes(bytes: number): string {
	if (bytes === 0) return '0 B';
	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

export default function OptimizeImages() {
	const [phase, setPhase] = createSignal<Phase>('loading');
	const [imageCount, setImageCount] = createSignal(0);
	const [alreadyOptimized, setAlreadyOptimized] = createSignal(0);
	const [error, setError] = createSignal('');

	// Results after optimization
	const [optimized, setOptimized] = createSignal(0);
	const [failed, setFailed] = createSignal(0);
	const [oldTotalSize, setOldTotalSize] = createSignal(0);
	const [newTotalSize, setNewTotalSize] = createSignal(0);

	const project = () => projectToOptimize();

	onMount(async () => {
		const proj = project();
		if (!proj) {
			setError('No project selected');
			setPhase('error');
			return;
		}

		try {
			const stats = await api.project.getImageStats(proj.id);
			if (stats.error) {
				setError(stats.error);
				setPhase('error');
				return;
			}

			setImageCount(stats.imageCount);
			setAlreadyOptimized(stats.alreadyOptimized);
			setPhase('confirm');
		} catch (_err) {
			setError('Failed to fetch image stats');
			setPhase('error');
		}
	});

	const handleOptimize = async () => {
		const proj = project();
		if (!proj) return;

		setPhase('processing');

		try {
			const result = await api.project.optimizeImages(proj.id);
			if (result.error) {
				setError(result.error);
				setPhase('error');
				return;
			}

			setOptimized(result.optimized);
			setFailed(result.failed);
			setOldTotalSize(result.oldTotalSize);
			setNewTotalSize(result.newTotalSize);
			setPhase('complete');
		} catch (_err) {
			setError('Failed to optimize images');
			setPhase('error');
		}
	};

	const handleClose = () => {
		setActiveModalId('');
	};

	return (
		<div class="flex flex-col gap-4">
			<Switch>
				<Match when={phase() === 'loading'}>
					<div class="flex flex-col items-center gap-4 py-8">
						<div class="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-blue-500"></div>
						<p class="text-zinc-400">Analyzing images...</p>
					</div>
				</Match>

				<Match when={phase() === 'confirm'}>
					<div class="flex flex-col gap-4">
						<Show
							when={imageCount() > 0}
							fallback={
								<div class="text-center py-4">
									<p class="text-zinc-300">
										No images to optimize.
										<Show when={alreadyOptimized() > 0}> All {alreadyOptimized()} images are already optimized.</Show>
									</p>
								</div>
							}
						>
							<div class="rounded-lg bg-zinc-800 p-4">
								<p class="text-zinc-300">
									You are about to optimize <span class="font-bold text-white">{imageCount()}</span> images in{' '}
									<span class="font-bold text-white">{project()?.name}</span>.
								</p>
								<Show when={alreadyOptimized() > 0}>
									<p class="mt-2 text-sm text-zinc-400">
										{alreadyOptimized()} images are already optimized and will be skipped.
									</p>
								</Show>
							</div>

							<div class="rounded-lg border border-amber-600/50 bg-amber-900/20 p-3">
								<p class="text-sm text-amber-200">
									Keep this page open during optimization. This may take a while for large projects.
								</p>
							</div>
						</Show>

						<div class="flex justify-end gap-2 pt-2">
							<button
								type="button"
								onClick={handleClose}
								class="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-all hover:bg-zinc-700 hover:text-white"
							>
								Cancel
							</button>
							<Show when={imageCount() > 0}>
								<button
									type="button"
									onClick={handleOptimize}
									class="rounded-lg border border-blue-500 bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-blue-500"
								>
									Continue
								</button>
							</Show>
						</div>
					</div>
				</Match>

				<Match when={phase() === 'processing'}>
					<div class="flex flex-col items-center gap-4 py-8">
						<div class="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-blue-500"></div>
						<p class="text-zinc-300">Optimizing images...</p>
						<p class="text-sm text-zinc-500">This may take a few moments</p>
					</div>
				</Match>

				<Match when={phase() === 'complete'}>
					<div class="flex flex-col gap-4">
						<div class="rounded-lg bg-green-900/30 border border-green-700/50 p-4">
							<p class="text-lg font-medium text-green-300">Optimization Complete</p>
						</div>

						<div class="grid grid-cols-2 gap-4">
							<div class="rounded-lg bg-zinc-800 p-4 text-center">
								<p class="text-2xl font-bold text-white">{optimized()}</p>
								<p class="text-sm text-zinc-400">Images optimized</p>
							</div>
							<Show when={failed() > 0}>
								<div class="rounded-lg bg-zinc-800 p-4 text-center">
									<p class="text-2xl font-bold text-red-400">{failed()}</p>
									<p class="text-sm text-zinc-400">Failed</p>
								</div>
							</Show>
						</div>

						<Show when={oldTotalSize() > 0}>
							<div class="rounded-lg bg-zinc-800 p-4">
								<div class="flex items-center justify-center gap-3 text-lg">
									<span class="text-zinc-400">{formatBytes(oldTotalSize())}</span>
									<span class="text-zinc-600">→</span>
									<span class="font-bold text-green-400">{formatBytes(newTotalSize())}</span>
								</div>
								<p class="mt-2 text-center text-sm text-zinc-400">
									Saved {formatBytes(oldTotalSize() - newTotalSize())} (
									{Math.round((1 - newTotalSize() / oldTotalSize()) * 100)}% reduction)
								</p>
							</div>
						</Show>

						<div class="flex justify-end pt-2">
							<button
								type="button"
								onClick={handleClose}
								class="rounded-lg border border-blue-500 bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-blue-500"
							>
								Done
							</button>
						</div>
					</div>
				</Match>

				<Match when={phase() === 'error'}>
					<div class="flex flex-col gap-4">
						<div class="rounded-lg bg-red-900/30 border border-red-700/50 p-4">
							<p class="text-red-300">{error()}</p>
						</div>
						<div class="flex justify-end">
							<button
								type="button"
								onClick={handleClose}
								class="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-all hover:bg-zinc-700 hover:text-white"
							>
								Close
							</button>
						</div>
					</div>
				</Match>
			</Switch>
		</div>
	);
}
