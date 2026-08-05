import { type Component, createMemo, createSignal } from 'solid-js';
import { cn } from '@/lib/cn';
import { speakText } from '@/lib/speak';
import { voiceEngineStatus } from '@/lib/state';

const TestVoice: Component = () => {
	const [voiceTestText, setVoiceTestText] = createSignal(
		'This is what your voice will sound like inside the application.',
	);

	const buttonText = createMemo(() => {
		const status = voiceEngineStatus();
		const opts = {
			ready: 'Speak',
			synthesizing: 'Synthesizing…',
			speaking: 'Speaking…',
			failed: 'Voice engine failed',
		};
		return opts[status];
	});

	const isDisabled = createMemo(() => {
		const status = voiceEngineStatus();
		return !['ready', 'failed'].includes(status);
	});

	return (
		<div class="flex flex-col gap-5 p-5 sm:p-6">
			<div class="flex flex-col gap-1">
				<h2 class="text-2xl font-semibold text-zinc-900">Try it out</h2>
				<p class="max-w-prose text-lg text-zinc-500">Type anything and hear how the selected voice says it.</p>
			</div>

			<div class="flex flex-col gap-4">
				{/* The test sentence sits in a speech bubble whose tail points at the Speak button below. */}
				<div
					class={cn(
						'relative max-w-2xl rounded-2xl border border-zinc-200 bg-white shadow-sm',
						'transition-all focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-200',
						'after:absolute after:-bottom-[7px] after:left-9 after:h-3.5 after:w-3.5 after:rotate-45',
						'after:border-r after:border-b after:border-zinc-200 after:bg-white',
					)}
				>
					<label class="sr-only" for="voice-test-sentence">
						Test sentence
					</label>
					<input
						id="voice-test-sentence"
						value={voiceTestText()}
						onInput={(e) => setVoiceTestText(e.currentTarget.value)}
						type="text"
						class="w-full rounded-2xl bg-transparent p-4 text-lg text-zinc-800 outline-none"
					/>
				</div>

				<button
					type="button"
					onClick={() => speakText(voiceTestText())}
					disabled={isDisabled()}
					class={cn(
						'flex w-fit min-w-48 items-center justify-center gap-3 rounded-full px-8 py-4 text-xl font-semibold text-white shadow-sm',
						'transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60',
						voiceEngineStatus() === 'failed' ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-700',
					)}
				>
					<i
						class={cn(
							'text-2xl',
							voiceEngineStatus() === 'failed' ? 'bi bi-exclamation-triangle-fill' : 'bi bi-volume-up-fill',
						)}
					/>
					<span>{buttonText()}</span>
				</button>
			</div>
		</div>
	);
};

export default TestVoice;
