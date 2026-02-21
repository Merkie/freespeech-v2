import { type Component, For, onMount, Show } from 'solid-js';
import { emojis } from '@/lib/eleven-labs-emojis';
import { elevenLabsVoiceId, setElevenLabsVoiceId } from '@/lib/state';

interface Voice {
	voice_id: string;
	name: string;
	labels: {
		accent: string;
		description: string;
		age: string;
		gender: string;
	};
}

interface ElevenLabsVoiceSelectorProps {
	voices: Voice[];
}

const ElevenLabsVoiceSelector: Component<ElevenLabsVoiceSelectorProps> = (props) => {
	let voicesContainerRef: HTMLDivElement | undefined;

	const getEmoji = (key: string, label: string) => {
		const category = emojis[key as keyof typeof emojis];
		if (!category) return '';
		return category[label as keyof typeof category] || '';
	};

	const formatLabelText = (label: string) => {
		return label
			.split('-')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ')
			.trim();
	};

	onMount(async () => {
		await new Promise((resolve) => setTimeout(resolve, 100));

		const selectedElVoiceDiv = document.getElementById('el-voice-active');

		if (selectedElVoiceDiv && voicesContainerRef) {
			voicesContainerRef.scrollTo({
				top: selectedElVoiceDiv.offsetTop - voicesContainerRef.clientHeight / 2,
				behavior: 'smooth',
			});
		}
	});

	return (
		<div class="flex flex-col">
			<p class="mb-4 text-2xl text-zinc-700">Select ElevenLabs voice:</p>
			<div
				id="el-voices"
				ref={voicesContainerRef}
				class="relative flex h-[400px] w-full flex-col overflow-y-auto rounded-xl border border-zinc-200 bg-white p-4 shadow-md"
			>
				<For each={props.voices}>
					{(voice, index) => (
						<div
							class={`group flex items-center gap-4 rounded-md p-2 px-4 ${
								index() % 2 === 0 ? 'bg-zinc-100' : 'bg-white'
							}`}
							id={elevenLabsVoiceId() === voice.voice_id ? 'el-voice-active' : ''}
						>
							<button
								aria-label={`Select ${voice.name} voice`}
								onClick={() => setElevenLabsVoiceId(voice.voice_id)}
								class="p-2"
							>
								<div
									class={`h-[20px] w-[20px] rounded-full ring-zinc-300 ring-offset-4 ${
										index() % 2 === 0 ? 'ring-offset-zinc-100' : 'ring-offset-white'
									} ${
										elevenLabsVoiceId() === voice.voice_id
											? 'bg-blue-600 ring-4'
											: `ring-2 ${index() % 2 === 0 ? 'bg-zinc-100' : 'bg-white'}`
									} transition-all`}
								></div>
							</button>
							<div class="flex flex-1 flex-wrap items-center gap-1">
								<p class="mr-2 text-lg font-medium whitespace-nowrap">{voice.name}</p>
								<Show when={voice.labels.accent}>
									<p class="rounded-md bg-zinc-50 px-2 text-sm whitespace-nowrap text-zinc-700 shadow-sm">
										{formatLabelText(voice.labels.accent)}
										{getEmoji('accent', voice.labels.accent)}
									</p>
								</Show>

								<Show when={voice.labels.description}>
									<p class="rounded-md bg-zinc-50 px-2 text-sm whitespace-nowrap text-zinc-700 shadow-sm">
										{formatLabelText(voice.labels.description)}
										{getEmoji('description', voice.labels.description)}
									</p>
								</Show>

								<Show when={voice.labels.age}>
									<p class="rounded-md bg-zinc-50 px-2 text-sm whitespace-nowrap text-zinc-700 shadow-sm">
										{formatLabelText(voice.labels.age)}
										{getEmoji('age', voice.labels.age)}
									</p>
								</Show>

								<Show when={voice.labels.gender}>
									<p class="rounded-md bg-zinc-50 px-2 text-sm whitespace-nowrap text-zinc-700 shadow-sm">
										{formatLabelText(voice.labels.gender)}
										{getEmoji('gender', voice.labels.gender)}
									</p>
								</Show>
							</div>
						</div>
					)}
				</For>
				<Show when={props.voices.length === 0}>
					<p class="absolute top-1/2 left-1/2 block -translate-x-1/2 -translate-y-1/2 text-center text-2xl text-zinc-500">
						No voices available
					</p>
				</Show>
			</div>
		</div>
	);
};

export default ElevenLabsVoiceSelector;
