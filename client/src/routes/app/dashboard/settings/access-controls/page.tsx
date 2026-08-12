import { type Component, createSignal, Show } from 'solid-js';
import { globalIsOnline } from '@/hooks/useNetworkStatus';
import { MODAL_ID } from '@/lib/constants';
import { disablePinLock, enableMathLock, setBoardCollaborationEnabled } from '@/lib/pin';
import { accessControlSettings, setActiveModalId } from '@/lib/state';
import type { EditPinMode } from '@/lib/types';
import OfflineSettingsNotice from '../_components/OfflineSettingsNotice';
import {
	SegmentedControl,
	SettingButton,
	SettingCard,
	SettingRow,
	SettingsPageHeader,
	Toggle,
} from '../_components/SettingControls';

const LOCK_MODE_OPTIONS: { value: EditPinMode; label: string }[] = [
	{ value: 'pin', label: '4-digit passcode' },
	{ value: 'math', label: 'Multiplication question' },
];

const AccessControlsPage: Component = () => {
	const [saving, setSaving] = createSignal(false);
	const [collaborationSaving, setCollaborationSaving] = createSignal(false);
	const [collaborationError, setCollaborationError] = createSignal('');
	const enabled = () => accessControlSettings().enabled;
	const mode = () => accessControlSettings().mode;
	const changesDisabled = () => !globalIsOnline() || saving();

	const handleToggle = async (next: boolean) => {
		if (!globalIsOnline()) return;
		if (!next) {
			setSaving(true);
			// A failed call leaves the toggle where it was, which is feedback enough.
			await disablePinLock().catch(() => undefined);
			setSaving(false);
			return;
		}
		// Turning it on always goes through PIN setup; the maths option is chosen afterwards.
		setActiveModalId(MODAL_ID.PIN_SETUP);
	};

	const handleModeChange = async (next: EditPinMode) => {
		if (!globalIsOnline()) return;
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
		if (!globalIsOnline() || collaborationSaving()) return;
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
		<div class="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 pb-[200px] sm:p-6 lg:p-8">
			<OfflineSettingsNotice />

			<SettingsPageHeader
				title="Access Controls"
				description="Control editing and shared board access"
				icon="bi bi-lock-fill"
				iconClass="bg-amber-100 text-amber-500"
			/>

			<SettingCard>
				<div class="divide-y divide-zinc-100">
					<SettingRow
						title="Require a passcode to edit"
						description="Asks for a passcode before entering edit mode or opening the dashboard, so a board cannot be rearranged or left by accident. Speaking tiles and moving between pages are never affected."
					>
						<Toggle
							checked={enabled()}
							onChange={handleToggle}
							label="Toggle edit passcode"
							disabled={changesDisabled()}
						/>
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
								disabled={changesDisabled()}
							/>
						</SettingRow>

						<Show when={mode() === 'pin'}>
							<SettingRow
								layout="stacked"
								title="Change passcode"
								description="Forgotten passcodes can also be reset from the prompt itself by answering a multiplication question."
							>
								<SettingButton onClick={() => setActiveModalId(MODAL_ID.PIN_SETUP)} disabled={changesDisabled()}>
									Set a new passcode
								</SettingButton>
							</SettingRow>
						</Show>
					</Show>
				</div>

				<div class="flex items-start gap-3 border-t border-zinc-100 bg-zinc-50 p-5 sm:px-6">
					<i class="bi bi-info-circle mt-0.5 text-lg text-zinc-400" />
					<p class="max-w-prose text-base text-zinc-500">
						Access controls are stored on your account and cached on this device so the current passcode keeps working
						offline. A connection is required to enable, disable, change, or reset them. This remains a guard against
						accidental taps rather than account security.
					</p>
				</div>
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
						disabled={!globalIsOnline() || collaborationSaving()}
					/>
				</SettingRow>

				<Show when={collaborationError()}>
					<p class="border-t border-red-100 bg-red-50 px-5 py-3 text-sm text-red-700 sm:px-6">{collaborationError()}</p>
				</Show>

				<div class="flex items-start gap-3 border-t border-zinc-100 bg-zinc-50 p-5 sm:px-6">
					<i class="bi bi-people-fill mt-0.5 text-lg text-sky-500" />
					<p class="max-w-prose text-base text-zinc-500">
						Turning this off pauses online collaborator access and pending invitations without deleting your
						collaborator lists. Turn it back on whenever you want to resume sharing.
					</p>
				</div>
			</SettingCard>
		</div>
	);
};

export default AccessControlsPage;
