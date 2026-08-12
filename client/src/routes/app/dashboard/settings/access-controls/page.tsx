import { type Component, createSignal, Show } from 'solid-js';
import { globalIsOnline } from '@/hooks/useNetworkStatus';
import { MODAL_ID } from '@/lib/constants';
import { disablePinLock, enableMathLock, setBoardCollaborationEnabled } from '@/lib/pin';
import { accessControlSettings, setActiveModalId } from '@/lib/state';
import type { EditPinMode } from '@/lib/types';
import {
	SegmentedControl,
	SettingButton,
	SettingCard,
	SettingFootnote,
	SettingRow,
	SettingsPageLayout,
	Toggle,
} from '../_components/SettingControls';
import { SETTINGS_SECTIONS } from '../_components/settings-sections';

const LOCK_MODE_OPTIONS: { value: EditPinMode; label: string }[] = [
	{ value: 'pin', label: '4-digit passcode' },
	{ value: 'math', label: 'Multiplication question' },
];

const AccessControlsPage: Component = () => {
	// Saving flags only guard against re-entrant taps; the controls are not dimmed while a save
	// is in flight because pin.ts applies changes optimistically and rolls back on failure.
	const [saving, setSaving] = createSignal(false);
	const [collaborationSaving, setCollaborationSaving] = createSignal(false);
	const [collaborationError, setCollaborationError] = createSignal('');
	const enabled = () => accessControlSettings().enabled;
	const mode = () => accessControlSettings().mode;
	const offline = () => !globalIsOnline();

	const handleToggle = async (next: boolean) => {
		if (offline() || saving()) return;
		if (!next) {
			setSaving(true);
			// A failed call snaps the toggle back, which is feedback enough.
			await disablePinLock().catch(() => undefined);
			setSaving(false);
			return;
		}
		// Turning it on always goes through PIN setup; the maths option is chosen afterwards.
		setActiveModalId(MODAL_ID.PIN_SETUP);
	};

	const handleModeChange = async (next: EditPinMode) => {
		if (offline() || saving()) return;
		if (next === mode()) return;
		if (next === 'math') {
			setSaving(true);
			await enableMathLock().catch(() => undefined);
			setSaving(false);
			return;
		}
		setActiveModalId(MODAL_ID.PIN_SETUP);
	};

	const handleCollaborationToggle = async (next: boolean) => {
		if (offline() || collaborationSaving()) return;
		setCollaborationSaving(true);
		setCollaborationError('');
		try {
			await setBoardCollaborationEnabled(next);
		} catch {
			setCollaborationError('Could not update board collaboration. Check your connection and try again.');
		} finally {
			setCollaborationSaving(false);
		}
	};

	return (
		<SettingsPageLayout section={SETTINGS_SECTIONS.accessControls}>
			<SettingCard>
				<div class="divide-y divide-zinc-100">
					<SettingRow
						title="Require a passcode to edit"
						description="Asks for a passcode before entering edit mode or opening the dashboard, so a board cannot be rearranged or left by accident. Speaking tiles and moving between pages are never affected."
					>
						<Toggle checked={enabled()} onChange={handleToggle} label="Toggle edit passcode" disabled={offline()} />
					</SettingRow>

					<Show when={enabled()}>
						<SettingRow
							layout="stacked"
							title="Passcode type"
							description="A 4-digit passcode is entered on a keypad. A multiplication question stores no secret at all — anyone who can do the arithmetic gets through, which is often enough to stop accidental taps."
						>
							<SegmentedControl
								value={mode()}
								options={LOCK_MODE_OPTIONS}
								onChange={handleModeChange}
								label="Passcode type"
								name="editPinMode"
								disabled={offline()}
							/>
						</SettingRow>

						<Show when={mode() === 'pin'}>
							<SettingRow
								layout="stacked"
								title="Change passcode"
								description="Forgotten passcodes can also be reset from the prompt itself by answering a multiplication question."
							>
								<SettingButton onClick={() => setActiveModalId(MODAL_ID.PIN_SETUP)} disabled={offline()}>
									Set a new passcode
								</SettingButton>
							</SettingRow>
						</Show>
					</Show>
				</div>

				<SettingFootnote icon="bi bi-info-circle">
					Access controls are stored on your account and cached on this device so the current passcode keeps working
					offline. A connection is required to enable, disable, change, or reset them. This remains a guard against
					accidental taps rather than account security.
				</SettingFootnote>
			</SettingCard>

			<SettingCard>
				<SettingRow
					title="Board collaboration"
					description="Adds a Manage Collaborators option to boards you own. Invited people can accept a board, use it from their own account, and save edits back to the same board."
				>
					<Toggle
						checked={accessControlSettings().collaborationEnabled}
						onChange={handleCollaborationToggle}
						label="Toggle board collaboration"
						disabled={offline()}
					/>
				</SettingRow>

				<Show when={collaborationError()}>
					<p class="border-t border-red-100 bg-red-50 px-5 py-3 text-sm text-red-700 sm:px-6">{collaborationError()}</p>
				</Show>

				<SettingFootnote icon="bi bi-people-fill" iconClass="text-sky-500">
					Turning this off pauses online collaborator access and pending invitations without deleting your collaborator
					lists. Turn it back on whenever you want to resume sharing.
				</SettingFootnote>
			</SettingCard>
		</SettingsPageLayout>
	);
};

export default AccessControlsPage;
