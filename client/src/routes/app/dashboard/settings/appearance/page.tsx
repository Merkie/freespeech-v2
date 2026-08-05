import type { Component } from 'solid-js';
import { localSettings, setLocalSettings } from '@/lib/state';
import { TILE_IMAGE_FIT_OPTIONS, TILE_TEXT_OVERFLOW_OPTIONS, TILE_TEXT_SIZE_OPTIONS } from '@/lib/tile-appearance';
import type { LocalSettings } from '@/lib/types';
import OfflineSettingsNotice from '../_components/OfflineSettingsNotice';
import { SegmentedControl, SettingCard, SettingRow, SettingsPageHeader, Toggle } from '../_components/SettingControls';
import TilePreview from './_components/TilePreview';

const AppearanceSettingsPage: Component = () => {
	// localSettings is stored as one object, so every setter merges rather than replaces.
	const update = <K extends keyof LocalSettings>(key: K, value: LocalSettings[K]) =>
		setLocalSettings({ ...localSettings(), [key]: value });

	return (
		<div class="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 pb-[200px] sm:p-6 lg:p-8">
			<OfflineSettingsNotice />

			<SettingsPageHeader
				title="Appearance"
				description="How tiles look on every board"
				icon="bi bi-palette-fill"
				iconClass="bg-purple-100 text-purple-500"
			/>

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

					<SettingRow
						title="Gapless grid"
						description="Removes the space between tiles so the board runs edge to edge as one solid surface. Tiles get a little bigger, and there is no dead space to tap between them."
					>
						<Toggle
							checked={localSettings().gaplessTileGrid}
							onChange={(next) => update('gaplessTileGrid', next)}
							label="Toggle gapless grid"
						/>
					</SettingRow>
				</div>
			</SettingCard>

			<SettingCard>
				<div class="flex flex-col gap-5 p-5 sm:p-6">
					<div class="flex flex-col gap-1">
						<h2 class="text-2xl font-semibold text-zinc-900">Preview</h2>
						<p class="max-w-prose text-lg text-zinc-500">
							Sample tiles drawn with the settings above. These settings apply to every board on this device.
						</p>
					</div>
					<TilePreview />
				</div>
			</SettingCard>
		</div>
	);
};

export default AppearanceSettingsPage;
