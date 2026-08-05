import { type Component, createSignal, onCleanup, Show } from 'solid-js';
import api from '@/lib/api';
import { cn } from '@/lib/cn';
import { setUser, user } from '@/lib/state';
import { Toggle } from '../../_components/SettingControls';

interface ElevenLabsPersonalKeyProps {
	apiKey: string;
	usePersonalElevenLabsKey: boolean;
}

const ElevenLabsPersonalKey: Component<ElevenLabsPersonalKeyProps> = (props) => {
	const [usePersonalKey, setUsePersonalKey] = createSignal(props.usePersonalElevenLabsKey);
	const [elevenLabsApiKey, setElevenLabsApiKey] = createSignal(props.apiKey);
	const [showKey, setShowKey] = createSignal(false);
	let inputRef: HTMLInputElement | undefined;
	let saveTimeout: ReturnType<typeof setTimeout> | undefined;

	const syncUser = (patch: Partial<NonNullable<ReturnType<typeof user>>>) => {
		const currentUser = user();
		if (currentUser) setUser({ ...currentUser, ...patch });
	};

	const handleToggle = async (next: boolean) => {
		setUsePersonalKey(next);
		await api.user.update({ usePersonalElevenLabsKey: next });
		syncUser({ usePersonalElevenLabsKey: next });
	};

	// Saving is debounced so typing a key doesn't send a request per keystroke.
	const saveKey = (value: string) => {
		clearTimeout(saveTimeout);
		saveTimeout = setTimeout(async () => {
			await api.user.update({ elevenLabsApiKey: value });
			syncUser({ elevenLabsApiKey: value });
		}, 600);
	};

	const flushSave = () => {
		if (saveTimeout === undefined) return;
		clearTimeout(saveTimeout);
		saveTimeout = undefined;
		const value = elevenLabsApiKey();
		api.user.update({ elevenLabsApiKey: value }).then(() => syncUser({ elevenLabsApiKey: value }));
	};

	onCleanup(() => flushSave());

	const revealKey = async () => {
		setShowKey(true);
		await new Promise((resolve) => setTimeout(resolve, 50));
		if (inputRef) {
			inputRef.focus();
			inputRef.setSelectionRange(elevenLabsApiKey().length, elevenLabsApiKey().length);
		}
	};

	return (
		<div class="flex flex-col gap-4 p-5 sm:p-6">
			<div class="flex flex-col gap-1">
				<div class="flex items-center justify-between gap-6">
					<h3 class="text-xl font-semibold text-zinc-900">Use my own ElevenLabs key</h3>
					<Toggle checked={usePersonalKey()} onChange={handleToggle} label="Use personal ElevenLabs key" />
				</div>
				<p class="max-w-prose text-lg text-zinc-500">
					A personal API key unlocks custom voices you've created from short audio clips, and helps reduce our costs.
					Get one at{' '}
					<a
						class="font-medium text-blue-600 underline underline-offset-2"
						target="_blank"
						href="https://elevenlabs.io/"
						rel="noopener"
					>
						elevenlabs.io
					</a>
					.
				</p>
			</div>

			<Show when={usePersonalKey()}>
				<div class="flex flex-col gap-2">
					<label class="text-lg font-medium text-zinc-700" for="elevenlabs-api-key">
						API key
					</label>
					<div
						class={cn(
							'flex max-w-xl items-center overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm',
							'transition-all focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-200',
						)}
					>
						<Show
							when={showKey()}
							fallback={
								<button
									type="button"
									onClick={revealKey}
									class={cn(
										'min-w-0 flex-1 truncate p-4 text-left font-mono text-lg',
										elevenLabsApiKey() ? 'text-zinc-500' : 'text-zinc-400',
									)}
								>
									{elevenLabsApiKey() ? '•'.repeat(Math.min(elevenLabsApiKey().length, 40)) : 'Add your key here'}
								</button>
							}
						>
							<input
								id="elevenlabs-api-key"
								ref={inputRef}
								value={elevenLabsApiKey()}
								onInput={(e) => {
									setElevenLabsApiKey(e.currentTarget.value);
									saveKey(e.currentTarget.value);
								}}
								onBlur={flushSave}
								type="text"
								autocomplete="off"
								spellcheck={false}
								class="min-w-0 flex-1 bg-transparent p-4 font-mono text-lg text-zinc-800 outline-none"
							/>
						</Show>
						<button
							type="button"
							aria-label={showKey() ? 'Hide API key' : 'Show API key'}
							onClick={() => (showKey() ? setShowKey(false) : revealKey())}
							class="p-4 text-xl text-zinc-400 transition-colors hover:text-zinc-600"
						>
							<i class={showKey() ? 'bi bi-eye-slash' : 'bi bi-eye'} />
						</button>
					</div>
					<p class="flex items-center gap-2 text-base text-zinc-500">
						<i class="bi bi-lock-fill" />
						<span>Encrypted and stored securely.</span>
					</p>
				</div>
			</Show>
		</div>
	);
};

export default ElevenLabsPersonalKey;
