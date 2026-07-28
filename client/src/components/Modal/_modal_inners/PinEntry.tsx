import { createEffect, createSignal, on, onCleanup, Show } from 'solid-js';
import Numpad from '@/components/Numpad';
import { globalIsOnline } from '@/hooks/useNetworkStatus';
import { cn } from '@/lib/cn';
import { MODAL_ID } from '@/lib/constants';
import {
	clearLockout,
	formatLockoutRemaining,
	lockoutRemainingMs,
	makeMultiplicationChallenge,
	PIN_LENGTH,
	registerFailedAttempt,
	verifyPin,
} from '@/lib/pin';
import {
	accessControlSettings,
	activeModalId,
	pinPromptText,
	runPinUnlockHandler,
	setActiveModalId,
} from '@/lib/state';

// 'entry' is the normal gate; 'reset' is the maths fallback shown after "Forgot PIN?".
type Mode = 'entry' | 'reset';

/** Dynamic title so the modal header follows the step the user is on. */
const [entryMode, setEntryMode] = createSignal<Mode>('entry');
export function pinEntryTitle() {
	if (accessControlSettings().mode === 'math') return 'Unlock';
	return entryMode() === 'entry' ? 'Enter PIN' : 'Reset PIN';
}

export default function PinEntry() {
	const [pinValue, setPinValue] = createSignal('');
	const [answerValue, setAnswerValue] = createSignal('');
	const [error, setError] = createSignal('');
	const [challenge, setChallenge] = createSignal(makeMultiplicationChallenge());
	const [shaking, setShaking] = createSignal(false);
	// Ticks so the lockout countdown is live rather than frozen at the moment it opened.
	const [now, setNow] = createSignal(Date.now());

	// In math mode there is no PIN to enter, so the challenge is the gate itself.
	const isMathLock = () => accessControlSettings().mode === 'math';
	const showingChallenge = () => isMathLock() || entryMode() === 'reset';

	const remainingMs = () => {
		now();
		return lockoutRemainingMs();
	};
	const locked = () => remainingMs() > 0;

	const timer = setInterval(() => setNow(Date.now()), 250);
	onCleanup(() => clearInterval(timer));

	let shakeTimer: ReturnType<typeof setTimeout> | undefined;
	const shake = () => {
		clearTimeout(shakeTimer);
		setShaking(true);
		shakeTimer = setTimeout(() => setShaking(false), 400);
	};
	onCleanup(() => clearTimeout(shakeTimer));

	// Start from a clean slate each time the modal is opened.
	createEffect(
		on(activeModalId, (id) => {
			if (id !== MODAL_ID.PIN_ENTRY) return;
			setEntryMode('entry');
			setPinValue('');
			setAnswerValue('');
			setError('');
			setChallenge(makeMultiplicationChallenge());
			setNow(Date.now());
		}),
	);

	const recordFailure = (message: string) => {
		shake();
		const result = registerFailedAttempt();
		if (result.lockedOut) {
			setNow(Date.now());
			setError('');
			return;
		}
		setError(`${message} ${result.attemptsLeft} attempt${result.attemptsLeft === 1 ? '' : 's'} left.`);
	};

	const unlock = () => {
		clearLockout();
		setActiveModalId('');
		runPinUnlockHandler();
	};

	const onPinComplete = async (value: string) => {
		if (locked()) return;
		if (await verifyPin(value)) {
			unlock();
			return;
		}
		setPinValue('');
		recordFailure('Incorrect PIN.');
	};

	const checkAnswer = () => {
		if (locked() || answerValue() === '') return;

		if (Number.parseInt(answerValue(), 10) === challenge().answer) {
			// A correct answer unlocks outright in math mode; in PIN mode it is the reset path,
			// so it hands over to the setup modal to choose a new PIN.
			if (isMathLock()) {
				unlock();
				return;
			}
			if (!globalIsOnline()) {
				setAnswerValue('');
				setChallenge(makeMultiplicationChallenge());
				setError('Connect to the internet to reset your PIN. Your current PIN still works offline.');
				return;
			}
			clearLockout();
			setActiveModalId(MODAL_ID.PIN_SETUP);
			return;
		}

		setAnswerValue('');
		setChallenge(makeMultiplicationChallenge());
		recordFailure('Wrong answer.');
	};

	// The prompt and any error share one fixed-height slot so the keypad never jumps.
	const statusClass = () =>
		cn('flex min-h-10 items-center justify-center text-center text-sm', error() ? 'text-red-400' : 'text-zinc-400');

	return (
		<div class="flex flex-col items-center gap-4 pt-1">
			<Show when={!locked()} fallback={<LockedOut remaining={() => formatLockoutRemaining(remainingMs())} />}>
				<Show
					when={showingChallenge()}
					fallback={
						<>
							<p class={statusClass()}>{error() || pinPromptText()}</p>
							<Numpad
								value={pinValue()}
								onChange={setPinValue}
								maxLength={PIN_LENGTH}
								onComplete={onPinComplete}
								shake={shaking()}
							/>
							<button
								type="button"
								onClick={() => {
									setEntryMode('reset');
									setAnswerValue('');
									setError('');
									setChallenge(makeMultiplicationChallenge());
								}}
								class="text-sm text-zinc-400 underline-offset-2 transition-all hover:text-zinc-200 hover:underline"
							>
								Forgot PIN?
							</button>
						</>
					}
				>
					<p class={statusClass()}>
						{error() || (isMathLock() ? pinPromptText() : 'To reset your PIN, solve this problem:')}
					</p>
					<p class="text-4xl font-semibold tracking-wide text-zinc-100">
						{challenge().a} &times; {challenge().b} = ?
					</p>
					<Numpad value={answerValue()} onChange={setAnswerValue} maxLength={2} masked={false} shake={shaking()} />
					<div class="flex w-full gap-2">
						<Show when={!isMathLock()}>
							<button
								type="button"
								onClick={() => {
									setEntryMode('entry');
									setPinValue('');
									setError('');
								}}
								class="h-12 flex-1 rounded-xl border border-zinc-700 text-sm text-zinc-300 transition-all hover:bg-zinc-800"
							>
								Back
							</button>
						</Show>
						<button
							type="button"
							onClick={checkAnswer}
							disabled={answerValue() === ''}
							class="h-12 flex-1 rounded-xl bg-blue-600 text-sm font-medium text-white transition-all hover:bg-blue-500 disabled:opacity-40"
						>
							Submit
						</button>
					</div>
				</Show>
			</Show>
		</div>
	);
}

function LockedOut(props: { remaining: () => string }) {
	return (
		<div class="flex flex-col items-center gap-3 py-6 text-center">
			<i class="bi bi-lock-fill text-4xl text-amber-400" />
			<p class="text-lg font-semibold text-zinc-100">Too many attempts</p>
			<p class="text-sm text-zinc-400">Try again in</p>
			<p class="font-mono text-3xl tabular-nums text-zinc-100">{props.remaining()}</p>
		</div>
	);
}
