import { createEffect, createSignal, on, onCleanup, Show } from 'solid-js';
import Numpad from '@/components/Numpad';
import { globalIsOnline } from '@/hooks/useNetworkStatus';
import { cn } from '@/lib/cn';
import { MODAL_ID } from '@/lib/constants';
import { enablePinLock, PIN_LENGTH } from '@/lib/pin';
import { activeModalId, setActiveModalId } from '@/lib/state';

type Step = 'choose' | 'confirm';

export default function PinSetup() {
	const [step, setStep] = createSignal<Step>('choose');
	const [first, setFirst] = createSignal('');
	const [second, setSecond] = createSignal('');
	const [error, setError] = createSignal('');
	const [saving, setSaving] = createSignal(false);
	const [shaking, setShaking] = createSignal(false);

	let shakeTimer: ReturnType<typeof setTimeout> | undefined;
	const shake = () => {
		clearTimeout(shakeTimer);
		setShaking(true);
		shakeTimer = setTimeout(() => setShaking(false), 400);
	};
	onCleanup(() => clearTimeout(shakeTimer));

	createEffect(
		on(activeModalId, (id) => {
			if (id !== MODAL_ID.PIN_SETUP) return;
			setStep('choose');
			setFirst('');
			setSecond('');
			setError('');
			setSaving(false);
		}),
	);

	const onFirstComplete = (value: string) => {
		setFirst(value);
		setSecond('');
		setError('');
		setStep('confirm');
	};

	const onSecondComplete = async (value: string) => {
		if (saving()) return;
		if (value !== first()) {
			// Send them back to the start rather than letting them retry the confirmation against a
			// PIN they may have mistyped in the first place.
			setStep('choose');
			setFirst('');
			setSecond('');
			setError('Those PINs did not match. Start again.');
			shake();
			return;
		}

		if (!globalIsOnline()) {
			setSecond('');
			setError('Connect to the internet to save a new passcode.');
			shake();
			return;
		}

		setSaving(true);
		try {
			await enablePinLock(value);
			setActiveModalId('');
		} catch {
			setSecond('');
			setError('Could not save the passcode. Check your connection and try again.');
			shake();
		} finally {
			setSaving(false);
		}
	};

	// The prompt and any error share one fixed-height slot so the keypad never jumps.
	const statusText = () =>
		error() || (step() === 'choose' ? 'Choose a 4-digit passcode.' : 'Enter it again to confirm.');

	return (
		<div class="flex flex-col items-center gap-4 pt-1">
			<p
				class={cn(
					'flex min-h-10 items-center justify-center text-center text-sm',
					error() ? 'text-red-400' : 'text-zinc-400',
				)}
			>
				{statusText()}
			</p>

			<Show
				when={step() === 'choose'}
				fallback={
					<Numpad
						value={second()}
						onChange={setSecond}
						maxLength={PIN_LENGTH}
						onComplete={onSecondComplete}
						disabled={saving()}
						shake={shaking()}
					/>
				}
			>
				<Numpad
					value={first()}
					onChange={setFirst}
					maxLength={PIN_LENGTH}
					onComplete={onFirstComplete}
					shake={shaking()}
				/>
			</Show>
		</div>
	);
}
