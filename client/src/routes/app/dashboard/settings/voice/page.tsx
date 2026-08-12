import { type Component, createResource, Show } from 'solid-js';
import api from '@/lib/api';
import { enableThirdPartyVoiceProviders, setEnableThirdPartyVoiceProviders, user } from '@/lib/state';
import ElevenLabsPersonalKey from '@/routes/app/dashboard/settings/voice/_components/ElevenLabsPersonalKey';
import ElevenLabsVoiceSelector from '@/routes/app/dashboard/settings/voice/_components/ElevenLabsVoiceSelector';
import InternalVoiceSelector from '@/routes/app/dashboard/settings/voice/_components/InternalVoiceSelector';
import TestVoice from '@/routes/app/dashboard/settings/voice/_components/TestVoice';
import { SettingCard, SettingRow, SettingsPageLayout, Toggle } from '../_components/SettingControls';
import { SETTINGS_SECTIONS } from '../_components/settings-sections';

const VoiceSettingsPage: Component = () => {
	const [voices] = createResource(async () => {
		const response = await api.tts.voices.elevenlabs();
		return response.voices || [];
	});

	return (
		<SettingsPageLayout section={SETTINGS_SECTIONS.voice}>
			<SettingCard>
				<SettingRow
					title="Use online voices"
					description="Online voices from ElevenLabs sound more natural and need an internet connection. If one can't be played, the device voice below is used instead."
				>
					<Toggle
						checked={enableThirdPartyVoiceProviders()}
						onChange={setEnableThirdPartyVoiceProviders}
						label="Use online voices"
					/>
				</SettingRow>
				<Show when={enableThirdPartyVoiceProviders()}>
					<div class="border-t border-zinc-100" />
					<ElevenLabsPersonalKey
						apiKey={user()?.elevenLabsApiKey || ''}
						usePersonalElevenLabsKey={user()?.usePersonalElevenLabsKey || false}
					/>
				</Show>
			</SettingCard>

			<SettingCard>
				<SettingRow
					layout="stacked"
					title="Choose a voice"
					description={
						enableThirdPartyVoiceProviders()
							? "The online voice speaks whenever you're connected. The device voice works everywhere, even offline."
							: 'Online voices are turned off, so the device voice is always used.'
					}
				>
					<div class="flex flex-col gap-6">
						<Show when={enableThirdPartyVoiceProviders()}>
							<ElevenLabsVoiceSelector voices={voices() || []} loading={voices.loading} />
						</Show>
						<InternalVoiceSelector />
					</div>
				</SettingRow>
			</SettingCard>

			<SettingCard>
				<TestVoice />
			</SettingCard>
		</SettingsPageLayout>
	);
};

export default VoiceSettingsPage;
