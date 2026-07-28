import { For, onCleanup, Show } from 'solid-js';
import { cn } from '@/lib/cn';

type NumpadProps = {
	value: string;
	maxLength: number;
	onChange: (next: string) => void;
	/** Fired once the value reaches maxLength, so a PIN submits without a separate button. */
	onComplete?: (value: string) => void;
	/** Masked shows filled dots (a PIN); unmasked shows the digits (a maths answer). */
	masked?: boolean;
	disabled?: boolean;
	/** Briefly true after a wrong entry; shakes the readout like a phone lock screen. */
	shake?: boolean;
};

/** Phone-style key faces: the digit plus the classic letter group underneath. */
const KEYS: [string, string][] = [
	['1', ''],
	['2', 'ABC'],
	['3', 'DEF'],
	['4', 'GHI'],
	['5', 'JKL'],
	['6', 'MNO'],
	['7', 'PQRS'],
	['8', 'TUV'],
	['9', 'WXYZ'],
];

const KEY_CLASS =
	'flex h-16 select-none flex-col items-center justify-center rounded-xl bg-zinc-800 transition-all duration-100 hover:bg-zinc-700 active:scale-95 active:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-40';

export default function Numpad(props: NumpadProps) {
	const masked = () => props.masked !== false;

	const press = (digit: string) => {
		if (props.disabled || props.value.length >= props.maxLength) return;
		const next = props.value + digit;
		props.onChange(next);
		if (next.length === props.maxLength) props.onComplete?.(next);
	};

	const backspace = () => {
		if (props.disabled) return;
		props.onChange(props.value.slice(0, -1));
	};

	// Physical keyboards work too, for carers on a laptop.
	const onKeyDown = (e: KeyboardEvent) => {
		if (e.key >= '0' && e.key <= '9') {
			e.preventDefault();
			press(e.key);
		} else if (e.key === 'Backspace') {
			e.preventDefault();
			backspace();
		}
	};
	window.addEventListener('keydown', onKeyDown);
	onCleanup(() => window.removeEventListener('keydown', onKeyDown));

	return (
		<div class="flex w-full flex-col items-center gap-5">
			<Show
				when={masked()}
				fallback={
					<div
						class={cn(
							'flex h-14 w-full items-center justify-center rounded-xl border border-zinc-700 bg-zinc-950/50 text-3xl font-semibold tracking-[0.3em] text-zinc-100',
							props.shake && 'animate-pin-shake',
						)}
					>
						{props.value}
					</div>
				}
			>
				<div class={cn('flex h-8 items-center gap-4', props.shake && 'animate-pin-shake')}>
					<For each={Array.from({ length: props.maxLength })}>
						{(_, i) => (
							<div
								class={cn(
									'h-3.5 w-3.5 rounded-full border-2 transition-all duration-150',
									i() < props.value.length ? 'scale-110 border-zinc-100 bg-zinc-100' : 'border-zinc-600 bg-transparent',
								)}
							/>
						)}
					</For>
				</div>
			</Show>

			<div class="grid w-full grid-cols-3 gap-2">
				<For each={KEYS}>
					{([digit, letters]) => (
						<button type="button" onClick={() => press(digit)} disabled={props.disabled} class={KEY_CLASS}>
							<span class="text-2xl font-semibold leading-none text-zinc-100">{digit}</span>
							<span class="mt-1 h-2.5 text-[10px] font-medium leading-none tracking-[0.2em] text-zinc-500">
								{letters}
							</span>
						</button>
					)}
				</For>
				<div />
				<button type="button" onClick={() => press('0')} disabled={props.disabled} class={KEY_CLASS}>
					<span class="text-2xl font-semibold leading-none text-zinc-100">0</span>
					<span class="mt-1 h-2.5" />
				</button>
				<button
					type="button"
					onClick={backspace}
					disabled={props.disabled}
					aria-label="Delete"
					title="Delete"
					class="flex h-16 select-none items-center justify-center rounded-xl text-2xl text-zinc-300 transition-all duration-100 hover:bg-zinc-800 active:scale-95 active:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
				>
					<i class="bi bi-backspace" />
				</button>
			</div>
		</div>
	);
}
