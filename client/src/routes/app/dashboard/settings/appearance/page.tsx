import type { Component } from 'solid-js';
import { localSettings, setLocalSettings } from '@/lib/state';
import { TILE_IMAGE_FIT_OPTIONS, TILE_TEXT_OVERFLOW_OPTIONS, TILE_TEXT_SIZE_OPTIONS } from '@/lib/tile-appearance';
import type { LocalSettings } from '@/lib/types';
import { SegmentedControl, SettingCard, SettingRow, SettingsPageLayout } from '../_components/SettingControls';
import { SETTINGS_SECTIONS } from '../_components/settings-sections';
import TilePreview from './_components/TilePreview';

const AppearanceSettingsPage: Component = () => {
	// localSettings is stored as one object, so every setter merges rather than replaces.
	const update = <K extends keyof LocalSettings>(key: K, value: LocalSettings[K]) =>
		setLocalSettings({ ...localSettings(), [key]: value });

	return (
		<SettingsPageLayout section={SETTINGS_SECTIONS.appearance}>
			<SettingCard>
				<div class="divide-y divide-zinc-100">
					<SettingRow layout="stacked" title="Tile text size" description="How large the label on each tile is drawn.">
						<SegmentedControl
							value={localSettings().tileTextSize}
							options={TILE_TEXT_SIZE_OPTIONS}
							onChange={(next) => update('tileTextSize', next)}
							label="Tile text size"
							name="tileTextSize"
						/>
					</SettingRow>

					<SettingRow
						layout="stacked"
						title="Long tile text"
						description="Truncate cuts a long label off with an ellipsis. Word wrap lets it run onto more lines, which leaves less room for the tile's image — especially at larger text sizes."
					>
						<SegmentedControl
							value={localSettings().tileTextOverflow}
							options={TILE_TEXT_OVERFLOW_OPTIONS}
							onChange={(next) => update('tileTextOverflow', next)}
							label="Long tile text"
							name="tileTextOverflow"
						/>
					</SettingRow>

					<SettingRow
						layout="stacked"
						title="Tile image fit"
						description="Contain shows the whole image, which suits symbol sets. Cover fills the tile and crops the edges, which usually suits photographs."
					>
						<SegmentedControl
							value={localSettings().tileImageFit}
							options={TILE_IMAGE_FIT_OPTIONS}
							onChange={(next) => update('tileImageFit', next)}
							label="Tile image fit"
							name="tileImageFit"
						/>
					</SettingRow>
				</div>
			</SettingCard>

			<SettingCard>
				<SettingRow
					layout="stacked"
					title="Preview"
					description="Sample tiles drawn with the settings above. These settings apply to every board on this device."
				>
					<TilePreview />
				</SettingRow>
			</SettingCard>
		</SettingsPageLayout>
	);
};

export default AppearanceSettingsPage;
