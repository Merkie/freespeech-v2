import { type Component, createMemo, createSignal, onMount } from 'solid-js';
import { offlineVoiceUri, setOfflineVoiceUri } from '@/lib/state';
import VoiceList, { type VoiceOption } from './VoiceList';

const InternalVoiceSelector: Component = () => {
	const [deviceVoices, setDeviceVoices] = createSignal<SpeechSynthesisVoice[]>([]);

	onMount(() => {
		setDeviceVoices(speechSynthesis.getVoices());
		// Some platforms (notably iOS Safari) deliver the voice list asynchronously.
		speechSynthesis.onvoiceschanged = () => setDeviceVoices(speechSynthesis.getVoices());
	});

	const options = createMemo<VoiceOption[]>(() =>
		deviceVoices().map((voice) => ({
			id: voice.voiceURI,
			name: voice.name,
			chips: voice.lang ? [voice.lang] : undefined,
		})),
	);

	return (
		<div class="flex min-w-0 flex-col gap-3">
			<div class="flex items-center gap-2">
				<i class="bi bi-tablet-fill text-lg text-zinc-500" />
				<h3 class="text-xl font-semibold text-zinc-800">Device voices</h3>
				<span class="rounded-full bg-green-100 px-2.5 py-0.5 text-sm font-medium text-green-700">Works offline</span>
			</div>
			<VoiceList
				name="device-voice"
				label="Device voice"
				options={options()}
				selectedId={offlineVoiceUri()}
				onSelect={setOfflineVoiceUri}
				emptyText="No voices found on this device."
			/>
		</div>
	);
};

export default InternalVoiceSelector;
