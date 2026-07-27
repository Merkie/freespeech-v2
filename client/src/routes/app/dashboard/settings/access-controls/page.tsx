import { A } from '@solidjs/router';
import { type Component, Show } from 'solid-js';
import { MODAL_ID } from '@/lib/constants';
import { disablePinLock, enableMathLock } from '@/lib/pin';
import { localSettings, setActiveModalId } from '@/lib/state';
import { showToast } from '@/lib/toast';
import type { EditPinMode } from '@/lib/types';
import { SegmentedControl, SettingRow, Toggle } from '../_components/SettingControls';

const LOCK_MODE_OPTIONS: { value: EditPinMode; label: string }[] = [
	{ value: 'pin', label: '4-digit passcode' },
	{ value: 'math', label: 'Multiplication question' },
];

const AccessControlsPage: Component = () => {
	const enabled = () => localSettings().editPinEnabled;
	const mode = () => localSettings().editPinMode;

	const handleToggle = (next: boolean) => {
		if (!next) {
			disablePinLock();
			showToast('Passcode turned off', 'success');
			return;
		}
		// Turning it on always goes through PIN setup; the maths option is chosen afterwards.
		setActiveModalId(MODAL_ID.PIN_SETUP);
	};

	const handleModeChange = (next: EditPinMode) => {
		if (next === mode()) return;
		if (next === 'math') {
			enableMathLock();
			showToast('Switched to a multiplication question', 'success');
			return;
		}
		setActiveModalId(MODAL_ID.PIN_SETUP);
	};

	return (
		<div class="flex flex-col gap-12 p-8 pb-[200px]">
			<div class="flex flex-col gap-8">
				<A href="/app/dashboard/settings" class="w-fit p-2 pl-0 text-xl text-zinc-600 hover:text-zinc-800">
					<i class="bi bi-arrow-left-short"></i>
					<span>Back</span>
				</A>

				<p class="border-b border-zinc-300 pb-8 text-4xl text-zinc-600">Access Controls</p>
			</div>

			<div class="flex flex-col gap-8">
				<SettingRow
					title="Require a passcode to edit"
					description="Asks for a passcode before entering edit mode or opening the dashboard, so a board cannot be rearranged or left by accident. Speaking tiles and moving between pages are never affected."
				>
					<Toggle checked={enabled()} onChange={handleToggle} label="Toggle edit passcode" />
				</SettingRow>

				<Show when={enabled()}>
					<SettingRow
						title="Passcode type"
						description="A 4-digit passcode is entered on a keypad. A multiplication question stores no secret at all — anyone who can do the arithmetic gets through, which is often enough to stop accidental taps."
					>
						<SegmentedControl
							value={mode()}
							options={LOCK_MODE_OPTIONS}
							onChange={handleModeChange}
							label="Passcode type"
							name="editPinMode"
						/>
					</SettingRow>

					<Show when={mode() === 'pin'}>
						<SettingRow
							title="Change passcode"
							description="Forgotten passcodes can also be reset from the prompt itself by answering a multiplication question."
						>
							<button
								type="button"
								onClick={() => setActiveModalId(MODAL_ID.PIN_SETUP)}
								class="rounded-lg border-2 border-zinc-300 px-5 py-3 text-xl text-zinc-600 transition-all hover:border-zinc-400 hover:bg-zinc-50"
							>
								Set a new passcode
							</button>
						</SettingRow>
					</Show>
				</Show>

				<p class="max-w-3xl text-lg text-zinc-500">
					This passcode is stored on this device only, so it keeps working with no connection and has to be set up again
					on each device. It is a guard against accidental taps rather than account security — it does not protect the
					data on the server.
				</p>
			</div>
		</div>
	);
};

export default AccessControlsPage;
