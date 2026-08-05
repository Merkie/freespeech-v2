import { type Component, createResource, Show } from 'solid-js';
import api from '@/lib/api';
import { enableThirdPartyVoiceProviders, setEnableThirdPartyVoiceProviders, user } from '@/lib/state';
import ElevenLabsPersonalKey from '@/routes/app/dashboard/settings/voice/_components/ElevenLabsPersonalKey';
import ElevenLabsVoiceSelector from '@/routes/app/dashboard/settings/voice/_components/ElevenLabsVoiceSelector';
import InternalVoiceSelector from '@/routes/app/dashboard/settings/voice/_components/InternalVoiceSelector';
import TestVoice from '@/routes/app/dashboard/settings/voice/_components/TestVoice';
import OfflineSettingsNotice from '../_components/OfflineSettingsNotice';
import { SettingCard, SettingsPageHeader, Toggle } from '../_components/SettingControls';

const VoiceSettingsPage: Component = () => {
	const [voices] = createResource(async () => {
		const response = await api.tts.voices.elevenlabs();
		return response.voices || [];
	});

	return (
		<div class="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 pb-[200px] sm:p-6 lg:p-8">
			<OfflineSettingsNotice />

			<SettingsPageHeader
				title="Voice"
				description="How FreeSpeech speaks out loud"
				icon="bi bi-volume-up-fill"
				iconClass="bg-blue-100 text-blue-500"
			/>

			<SettingCard>
				<div class="flex flex-col gap-1 p-5 sm:p-6">
					<div class="flex items-center justify-between gap-6">
						<h2 class="text-2xl font-semibold text-zinc-900">Use online voices</h2>
						<Toggle
							checked={enableThirdPartyVoiceProviders()}
							onChange={setEnableThirdPartyVoiceProviders}
							label="Use online voices"
						/>
					</div>
					<p class="max-w-prose text-lg text-zinc-500">
						Online voices from ElevenLabs sound more natural and need an internet connection. If one can't be played,
						the device voice below is used instead.
					</p>
				</div>
				<Show when={enableThirdPartyVoiceProviders()}>
					<div class="border-t border-zinc-100" />
					<ElevenLabsPersonalKey
						apiKey={user()?.elevenLabsApiKey || ''}
						usePersonalElevenLabsKey={user()?.usePersonalElevenLabsKey || false}
					/>
				</Show>
			</SettingCard>

			<SettingCard>
				<div class="flex flex-col gap-5 p-5 sm:p-6">
					<div class="flex flex-col gap-1">
						<h2 class="text-2xl font-semibold text-zinc-900">Choose a voice</h2>
						<p class="max-w-prose text-lg text-zinc-500">
							<Show
								when={enableThirdPartyVoiceProviders()}
								fallback="Online voices are turned off, so the device voice is always used."
							>
								The online voice speaks whenever you're connected. The device voice works everywhere, even offline.
							</Show>
						</p>
					</div>
					<div class="flex flex-col gap-6">
						<Show when={enableThirdPartyVoiceProviders()}>
							<ElevenLabsVoiceSelector voices={voices() || []} loading={voices.loading} />
						</Show>
						<InternalVoiceSelector />
					</div>
				</div>
			</SettingCard>

			<SettingCard>
				<TestVoice />
			</SettingCard>
		</div>
	);
};

export default VoiceSettingsPage;
