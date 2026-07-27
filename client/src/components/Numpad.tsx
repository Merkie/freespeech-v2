import { For, Show } from 'solid-js';
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
};

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

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

	return (
		<div class="flex flex-col items-center gap-6">
			<Show
				when={masked()}
				fallback={
					<div class="flex h-12 min-w-[96px] items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800 px-4 text-3xl font-semibold tracking-[0.3em] text-zinc-100">
						{props.value || ' '}
					</div>
				}
			>
				<div class="flex h-8 items-center gap-3">
					<For each={Array.from({ length: props.maxLength })}>
						{(_, i) => (
							<div
								class={cn(
									'h-4 w-4 rounded-full transition-all',
									i() < props.value.length ? 'scale-100 bg-zinc-100' : 'scale-90 bg-zinc-700',
								)}
							/>
						)}
					</For>
				</div>
			</Show>

			<div class="grid grid-cols-3 gap-3">
				<For each={KEYS}>
					{(key) => (
						<button
							type="button"
							onClick={() => press(key)}
							disabled={props.disabled}
							class="grid h-16 w-16 place-items-center rounded-full bg-zinc-800 text-2xl font-medium text-zinc-100 transition-all hover:bg-zinc-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
						>
							{key}
						</button>
					)}
				</For>
				<div />
				<button
					type="button"
					onClick={() => press('0')}
					disabled={props.disabled}
					class="grid h-16 w-16 place-items-center rounded-full bg-zinc-800 text-2xl font-medium text-zinc-100 transition-all hover:bg-zinc-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
				>
					0
				</button>
				<button
					type="button"
					onClick={backspace}
					disabled={props.disabled}
					aria-label="Delete"
					title="Delete"
					class="grid h-16 w-16 place-items-center rounded-full text-2xl text-zinc-300 transition-all hover:bg-zinc-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
				>
					<i class="bi bi-backspace" />
				</button>
			</div>
		</div>
	);
}
