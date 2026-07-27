import { createEffect, createSignal, on, Show } from 'solid-js';
import Numpad from '@/components/Numpad';
import { MODAL_ID } from '@/lib/constants';
import { enablePinLock, PIN_LENGTH } from '@/lib/pin';
import { activeModalId, setActiveModalId } from '@/lib/state';
import { showToast } from '@/lib/toast';

type Step = 'choose' | 'confirm';

export default function PinSetup() {
	const [step, setStep] = createSignal<Step>('choose');
	const [first, setFirst] = createSignal('');
	const [second, setSecond] = createSignal('');
	const [error, setError] = createSignal('');

	createEffect(
		on(activeModalId, (id) => {
			if (id !== MODAL_ID.PIN_SETUP) return;
			setStep('choose');
			setFirst('');
			setSecond('');
			setError('');
		}),
	);

	const onFirstComplete = (value: string) => {
		setFirst(value);
		setSecond('');
		setError('');
		setStep('confirm');
	};

	const onSecondComplete = async (value: string) => {
		if (value !== first()) {
			// Send them back to the start rather than letting them retry the confirmation against a
			// PIN they may have mistyped in the first place.
			setStep('choose');
			setFirst('');
			setSecond('');
			setError('Those PINs did not match. Start again.');
			return;
		}

		await enablePinLock(value);
		setActiveModalId('');
		showToast('Passcode set', 'success');
	};

	return (
		<div class="flex flex-col items-center gap-6 py-2">
			<p class="text-center text-sm text-zinc-400">
				{step() === 'choose' ? 'Choose a 4-digit passcode.' : 'Enter it again to confirm.'}
			</p>

			<Show
				when={step() === 'choose'}
				fallback={<Numpad value={second()} onChange={setSecond} maxLength={PIN_LENGTH} onComplete={onSecondComplete} />}
			>
				<Numpad value={first()} onChange={setFirst} maxLength={PIN_LENGTH} onComplete={onFirstComplete} />
			</Show>

			<Show when={error()}>
				<p class="text-center text-sm text-red-400">{error()}</p>
			</Show>

			<p class="max-w-xs text-center text-xs text-zinc-500">
				This passcode is stored on this device only. If it is forgotten, a multiplication question can be answered to
				set a new one.
			</p>
		</div>
	);
}
