import { type Component, createMemo, Show } from 'solid-js';
import { emojis } from '@/lib/eleven-labs-emojis';
import { elevenLabsVoiceId, setElevenLabsVoiceId } from '@/lib/state';
import VoiceList, { type VoiceOption } from './VoiceList';

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
	loading?: boolean;
}

const getEmoji = (key: string, label: string) => {
	const category = emojis[key as keyof typeof emojis];
	if (!category) return '';
	return category[label as keyof typeof category] || '';
};

const formatLabelText = (label: string) => {
	return label
		.split(/[-_]/)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ')
		.trim();
};

function buildChips(labels: Voice['labels']): string[] {
	return (['accent', 'description', 'age', 'gender'] as const)
		.filter((key) => labels[key])
		.map((key) => [formatLabelText(labels[key]), getEmoji(key, labels[key])].filter(Boolean).join(' '));
}

const ElevenLabsVoiceSelector: Component<ElevenLabsVoiceSelectorProps> = (props) => {
	const options = createMemo<VoiceOption[]>(() =>
		props.voices.map((voice) => ({
			id: voice.voice_id,
			name: voice.name,
			chips: buildChips(voice.labels),
		})),
	);

	return (
		<div class="flex min-w-0 flex-col gap-3">
			<div class="flex items-center gap-2">
				<i class="bi bi-cloud-fill text-lg text-blue-500" />
				<h3 class="text-xl font-semibold text-zinc-800">Online voices</h3>
				<Show when={!props.loading}>
					<span class="rounded-full bg-zinc-100 px-2.5 py-0.5 text-sm font-medium text-zinc-500">
						{options().length}
					</span>
				</Show>
			</div>
			<VoiceList
				name="elevenlabs-voice"
				label="Online voice"
				options={options()}
				selectedId={elevenLabsVoiceId()}
				onSelect={setElevenLabsVoiceId}
				loading={props.loading}
				emptyText="Online voices couldn't be loaded. Check your connection and try again."
			/>
		</div>
	);
};

export default ElevenLabsVoiceSelector;
