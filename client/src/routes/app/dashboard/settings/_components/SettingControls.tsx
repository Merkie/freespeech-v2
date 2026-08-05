import { A } from '@solidjs/router';
import { For, type JSX } from 'solid-js';
import { cn } from '@/lib/cn';

// Shared controls for the settings screens. The dashboard is used on tablets by carers as often
// as by communicators, so hit targets stay large and every control is labelled for screen readers.

// Back button + icon badge + title. The badge repeats the icon and colour of the card that was
// tapped on the settings index, so landing on a subpage confirms where the tap went.
export function SettingsPageHeader(props: { title: string; description?: string; icon: string; iconClass?: string }) {
	return (
		<div class="flex items-center gap-4">
			<A
				href="/app/dashboard/settings"
				aria-label="Back to settings"
				class="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-zinc-200 bg-white text-2xl text-zinc-600 shadow-sm transition-all hover:text-zinc-900 active:scale-95"
			>
				<i class="bi bi-arrow-left" />
			</A>
			<div class={cn('grid h-12 w-12 shrink-0 place-items-center rounded-xl text-2xl', props.iconClass)}>
				<i class={props.icon} />
			</div>
			<div class="min-w-0">
				<h1 class="text-3xl font-semibold text-zinc-900">{props.title}</h1>
				{props.description ? <p class="text-lg text-zinc-500">{props.description}</p> : null}
			</div>
		</div>
	);
}

export function SettingCard(props: { children: JSX.Element; class?: string }) {
	return (
		<section class={cn('overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm', props.class)}>
			{props.children}
		</section>
	);
}

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
				'relative h-8 w-14 shrink-0 rounded-full transition-colors',
				'focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2',
				'disabled:cursor-not-allowed disabled:opacity-50',
				props.checked ? 'bg-green-500' : 'bg-zinc-300',
			)}
		>
			<span
				class={cn(
					'absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow-sm transition-transform',
					props.checked && 'translate-x-6',
				)}
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
							'relative cursor-pointer rounded-lg border-2 px-5 py-3 text-xl transition-all',
							'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-pink-400 has-[:focus-visible]:ring-offset-2',
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
							class="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
						/>
						{option.label}
					</label>
				)}
			</For>
		</fieldset>
	);
}
