import { useNavigate } from '@solidjs/router';
import { createSignal, Show } from 'solid-js';
import api from '@/lib/api';
import type { OpenBoardImportResult } from '@/lib/api/endpoints/project';
import { OfflineError } from '@/lib/api/util';
import { cn } from '@/lib/cn';
import { setActiveModalId } from '@/lib/state';

// Large boards fetch and transcode a few hundred symbols server-side, so this is not instant.
export default function ImportBoard() {
	const navigate = useNavigate();
	const [isImporting, setIsImporting] = createSignal(false);
	const [error, setError] = createSignal('');
	const [result, setResult] = createSignal<OpenBoardImportResult | null>(null);
	const [isDragging, setIsDragging] = createSignal(false);
	let fileInput: HTMLInputElement | undefined;

	const runImport = async (file: File) => {
		setError('');
		setResult(null);

		if (!/\.(obf|obz)$/i.test(file.name)) {
			setError('Choose a .obf or .obz file.');
			return;
		}

		setIsImporting(true);
		try {
			const data = await api.project.importOpenBoard(file);
			if (data.error || !data.projectId) {
				setError(data.error || 'That board could not be imported.');
				return;
			}
			setResult(data);
			// Generating the board thumbnail is best-effort; a failure here must not block the user
			// from opening a project that imported fine.
			api.project.updateThumbnail(data.projectId).catch(() => {});
		} catch (err) {
			setError(
				err instanceof OfflineError
					? 'Importing a board needs an internet connection.'
					: 'That board could not be imported.',
			);
		} finally {
			setIsImporting(false);
		}
	};

	const onFilePicked = (e: Event) => {
		const file = (e.currentTarget as HTMLInputElement).files?.[0];
		if (file) runImport(file);
	};

	const onDrop = (e: DragEvent) => {
		e.preventDefault();
		setIsDragging(false);
		const file = e.dataTransfer?.files?.[0];
		if (file) runImport(file);
	};

	const openImported = () => {
		const id = result()?.projectId;
		setActiveModalId('');
		if (id) navigate(`/app/project/${id}`);
	};

	const missingImages = () => {
		const r = result();
		if (!r || r.imagesTotal === undefined || r.imagesResolved === undefined) return 0;
		return r.imagesTotal - r.imagesResolved;
	};

	return (
		<div class="flex flex-col gap-4">
			<Show
				when={!result()}
				fallback={
					<>
						<div class="flex flex-col items-center gap-2 py-4 text-center">
							<i class="bi bi-check-circle text-4xl text-green-400" />
							<p class="text-zinc-100">Imported successfully.</p>
							<p class="text-sm text-zinc-400">
								{result()?.pageCount} page{result()?.pageCount === 1 ? '' : 's'}, {result()?.tileCount} tile
								{result()?.tileCount === 1 ? '' : 's'}
							</p>
							<Show when={missingImages() > 0}>
								<p class="text-sm text-amber-400">
									{missingImages()} image{missingImages() === 1 ? '' : 's'} could not be downloaded. Those tiles kept
									their words but have no picture.
								</p>
							</Show>
						</div>
						<button
							type="button"
							onClick={openImported}
							class="flex items-center justify-center gap-2 rounded-md border border-blue-500 bg-blue-600 p-2 text-white transition-colors hover:bg-blue-500"
						>
							<i class="bi bi-box-arrow-in-right" />
							<span>Open board</span>
						</button>
					</>
				}
			>
				<p class="text-sm text-zinc-300">
					Bring a board over from another AAC app. Pages, words, colours, pictures and folder links all come across.
				</p>

				<button
					type="button"
					onClick={() => fileInput?.click()}
					onDragOver={(e) => {
						e.preventDefault();
						setIsDragging(true);
					}}
					onDragLeave={() => setIsDragging(false)}
					onDrop={onDrop}
					disabled={isImporting()}
					class={cn(
						'flex flex-col items-center gap-2 rounded-lg border-2 border-dashed p-8 transition-colors',
						isDragging() ? 'border-blue-400 bg-blue-500/10' : 'border-zinc-700 hover:border-zinc-600',
						isImporting() && 'cursor-wait opacity-60',
					)}
				>
					<Show
						when={!isImporting()}
						fallback={
							<>
								<i class="bi bi-arrow-repeat animate-spin text-3xl text-zinc-300" />
								<span class="text-sm text-zinc-300">Importing — this can take a minute...</span>
								<span class="text-xs text-zinc-500">Downloading and converting the pictures</span>
							</>
						}
					>
						<i class="bi bi-file-earmark-arrow-up text-3xl text-zinc-300" />
						<span class="text-sm text-zinc-200">Choose a file or drop one here</span>
						<span class="text-xs text-zinc-500">.obf or .obz, up to 50 MB</span>
					</Show>
				</button>

				<input ref={fileInput} type="file" accept=".obf,.obz" onChange={onFilePicked} class="hidden" />

				<Show when={error()}>
					<div class="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">{error()}</div>
				</Show>
			</Show>
		</div>
	);
}
