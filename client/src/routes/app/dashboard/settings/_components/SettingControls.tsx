import { For, type JSX } from 'solid-js';
import { cn } from '@/lib/cn';

// Shared controls for the settings screens. The dashboard is used on tablets by carers as often
// as by communicators, so hit targets stay large and every control is labelled for screen readers.

export function SettingRow(props: { title: string; description?: string; children: JSX.Element }) {
	return (
		<div class="flex flex-col gap-3 border-b border-zinc-200 pb-8 last:border-b-0">
			<div class="flex flex-wrap items-center justify-between gap-4">
				<p class="text-3xl text-zinc-800">{props.title}</p>
				{props.children}
			</div>
			{props.description ? <p class="max-w-3xl text-xl text-zinc-500">{props.description}</p> : null}
		</div>
	);
}

export function Toggle(props: {
	checked: boolean;
	onChange: (next: boolean) => void;
	label: string;
	disabled?: boolean;
}) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={props.checked}
			aria-label={props.label}
			onClick={() => props.onChange(!props.checked)}
			disabled={props.disabled}
			class={cn(
				'relative w-[48px] shrink-0 scale-[120%] rounded-full p-1 shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-50',
				props.checked ? 'bg-green-500' : 'bg-zinc-300',
			)}
		>
			<div
				style={{ transform: `translateX(${props.checked ? '100%' : '0'})` }}
				class="h-[20px] w-[20px] rounded-full bg-white shadow-sm transition-all"
			/>
		</button>
	);
}

export function SegmentedControl<T extends string>(props: {
	value: T;
	options: readonly { value: T; label: string }[];
	onChange: (next: T) => void;
	label: string;
	name: string;
	disabled?: boolean;
}) {
	// Built on real radio inputs rather than buttons with ARIA roles, so arrow-key navigation and
	// screen-reader group announcements come from the platform instead of being reimplemented.
	return (
		<fieldset class="flex flex-wrap gap-2 border-0 p-0">
			<legend class="sr-only">{props.label}</legend>
			<For each={props.options}>
				{(option) => (
					<label
						class={cn(
							'cursor-pointer rounded-lg border-2 px-5 py-3 text-xl transition-all',
							'focus-within:ring-2 focus-within:ring-pink-400 focus-within:ring-offset-2',
							props.disabled && 'cursor-not-allowed opacity-50',
							props.value === option.value
								? 'border-pink-400 bg-pink-50 text-pink-700'
								: 'border-zinc-300 text-zinc-600 hover:border-zinc-400 hover:bg-zinc-50',
						)}
					>
						<input
							type="radio"
							name={props.name}
							value={option.value}
							checked={props.value === option.value}
							onChange={() => props.onChange(option.value)}
							disabled={props.disabled}
							class="sr-only"
						/>
						{option.label}
					</label>
				)}
			</For>
		</fieldset>
	);
}
