import { A } from '@solidjs/router';
import { type Component, createResource, Show } from 'solid-js';
import api from '@/lib/api';
import { enableThirdPartyVoiceProviders, setEnableThirdPartyVoiceProviders, user } from '@/lib/state';
import ElevenLabsPersonalKey from '@/routes/app/dashboard/settings/voice/_components/ElevenLabsPersonalKey';
import ElevenLabsVoiceSelector from '@/routes/app/dashboard/settings/voice/_components/ElevenLabsVoiceSelector';
import InternalVoiceSelector from '@/routes/app/dashboard/settings/voice/_components/InternalVoiceSelector';
import TestVoice from '@/routes/app/dashboard/settings/voice/_components/TestVoice';
import OfflineSettingsNotice from '../_components/OfflineSettingsNotice';

const VoiceSettingsPage: Component = () => {
	const [voices] = createResource(async () => {
		const response = await api.tts.voices.elevenlabs();
		return response.voices || [];
	});

	return (
		<div class="flex flex-col gap-12 p-8 pb-[200px]">
			<OfflineSettingsNotice />
			<div class="flex flex-col gap-8">
				<A href="/app/dashboard/settings" class="w-fit p-2 pl-0 text-xl text-zinc-600 hover:text-zinc-800">
					<i class="bi bi-arrow-left-short"></i>
					<span>Back</span>
				</A>

				<p class="border-b border-zinc-300 pb-8 text-4xl text-zinc-600">Voice Settings</p>
			</div>

			<div class="flex flex-col">
				<div class="flex items-center gap-4">
					<p class="text-3xl text-zinc-800">Enable third-party voice providers:</p>
					<button
						aria-label={`Turn ${enableThirdPartyVoiceProviders() ? 'off' : 'on'} third-party voice providers`}
						onClick={() => setEnableThirdPartyVoiceProviders(!enableThirdPartyVoiceProviders())}
						class={`relative w-[48px] scale-[120%] rounded-full p-1 shadow-sm transition-all ${
							enableThirdPartyVoiceProviders() ? 'bg-green-500' : 'bg-zinc-300'
						}`}
					>
						<div
							style={{
								transform: `translateX(${!enableThirdPartyVoiceProviders() ? '0' : '100%'})`,
							}}
							class="h-[20px] w-[20px] rounded-full bg-white shadow-sm transition-all"
						></div>
					</button>
				</div>
				<p class="mt-2 max-w-[750px] text-zinc-800">
					When enabled, the selected third-party voice will be the primary voice used by the app. The internal voice
					will still be used if the third-party voice fails. Third-party voices require a good internet connection for
					best results.
				</p>
			</div>

			<Show when={enableThirdPartyVoiceProviders()}>
				<ElevenLabsPersonalKey
					apiKey={user()?.elevenLabsApiKey || ''}
					usePersonalElevenLabsKey={user()?.usePersonalElevenLabsKey || false}
				/>
			</Show>

			<div class="flex flex-col gap-4">
				<p class="text-3xl text-zinc-800">Select voice:</p>
				<div
					class={`grid gap-8 transition-all ${
						enableThirdPartyVoiceProviders()
							? 'grid-cols-1 grid-rows-2 lg:grid-cols-2 lg:grid-rows-1'
							: 'grid-cols-1 grid-rows-1'
					}`}
				>
					<Show when={enableThirdPartyVoiceProviders()}>
						<Show when={!voices.loading} fallback={<div>Loading voices...</div>}>
							<ElevenLabsVoiceSelector voices={voices() || []} />
						</Show>
					</Show>
					<InternalVoiceSelector />
				</div>
			</div>

			<TestVoice />
		</div>
	);
};

export default VoiceSettingsPage;
