import { createEffect, createSignal, on, onCleanup, Show } from 'solid-js';
import Numpad from '@/components/Numpad';
import { MODAL_ID } from '@/lib/constants';
import {
	clearLockout,
	formatLockoutRemaining,
	makeMultiplicationChallenge,
	PIN_LENGTH,
	registerFailedAttempt,
	verifyPin,
} from '@/lib/pin';
import { activeModalId, localSettings, pinPromptText, runPinUnlockHandler, setActiveModalId } from '@/lib/state';

// 'entry' is the normal gate; 'reset' is the maths fallback shown after "Forgot PIN?".
type Mode = 'entry' | 'reset';

/** Dynamic title so the modal header follows the step the user is on. */
const [entryMode, setEntryMode] = createSignal<Mode>('entry');
export function pinEntryTitle() {
	if (localSettings().editPinMode === 'math') return 'Unlock';
	return entryMode() === 'entry' ? 'Enter PIN' : 'Reset PIN';
}

export default function PinEntry() {
	const [pinValue, setPinValue] = createSignal('');
	const [answerValue, setAnswerValue] = createSignal('');
	const [error, setError] = createSignal('');
	const [challenge, setChallenge] = createSignal(makeMultiplicationChallenge());
	// Ticks so the lockout countdown is live rather than frozen at the moment it opened.
	const [now, setNow] = createSignal(Date.now());

	// In math mode there is no PIN to enter, so the challenge is the gate itself.
	const isMathLock = () => localSettings().editPinMode === 'math';
	const showingChallenge = () => isMathLock() || entryMode() === 'reset';

	const remainingMs = () => Math.max(0, (localSettings().editPinLockoutUntil || 0) - now());
	const locked = () => remainingMs() > 0;

	const timer = setInterval(() => setNow(Date.now()), 250);
	onCleanup(() => clearInterval(timer));

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
			clearLockout();
			setActiveModalId(MODAL_ID.PIN_SETUP);
			return;
		}

		setAnswerValue('');
		setChallenge(makeMultiplicationChallenge());
		recordFailure('Wrong answer.');
	};

	return (
		<div class="flex flex-col items-center gap-6 py-2">
			<Show when={!locked()} fallback={<LockedOut remaining={() => formatLockoutRemaining(remainingMs())} />}>
				<Show
					when={showingChallenge()}
					fallback={
						<>
							<p class="text-center text-sm text-zinc-400">{pinPromptText()}</p>
							<Numpad value={pinValue()} onChange={setPinValue} maxLength={PIN_LENGTH} onComplete={onPinComplete} />
							<Show when={error()}>
								<p class="text-center text-sm text-red-400">{error()}</p>
							</Show>
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
					<p class="text-center text-sm text-zinc-400">
						{isMathLock() ? pinPromptText() : 'To reset your PIN, solve this problem:'}
					</p>
					<p class="text-4xl font-semibold text-zinc-100">
						{challenge().a} &times; {challenge().b} = ?
					</p>
					<Numpad value={answerValue()} onChange={setAnswerValue} maxLength={2} masked={false} />
					<Show when={error()}>
						<p class="text-center text-sm text-red-400">{error()}</p>
					</Show>
					<div class="flex w-full items-center justify-center gap-3">
						<Show when={!isMathLock()}>
							<button
								type="button"
								onClick={() => {
									setEntryMode('entry');
									setPinValue('');
									setError('');
								}}
								class="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition-all hover:bg-zinc-800"
							>
								Back
							</button>
						</Show>
						<button
							type="button"
							onClick={checkAnswer}
							disabled={answerValue() === ''}
							class="rounded-md border border-blue-500 bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-blue-500 disabled:opacity-40"
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
