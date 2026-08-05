import { type Component, createEffect, For, Show } from 'solid-js';
import { cn } from '@/lib/cn';

export type VoiceOption = {
	id: string;
	name: string;
	chips?: string[];
};

// One scrollable list of selectable voices, shared by the online and device pickers so the two
// always look and behave identically. Rows are whole-row tap targets built on real radio inputs,
// so keyboard and screen-reader behaviour comes from the platform.
const VoiceList: Component<{
	name: string;
	label: string;
	options: VoiceOption[];
	selectedId: string | null | undefined;
	onSelect: (id: string) => void;
	loading?: boolean;
	emptyText: string;
	/** 'below' puts chips on their own line under the voice name; default is inline after it. */
	chipPlacement?: 'inline' | 'below';
	/** 'code' renders chips as small mono tags (for language codes); default is rounded pills. */
	chipVariant?: 'pill' | 'code';
}> = (props) => {
	let containerRef: HTMLDivElement | undefined;

	// Center the saved voice whenever the list content arrives (device voices load async via
	// onvoiceschanged). Deliberately not tracking selectedId — tapping a row must not re-scroll.
	createEffect(() => {
		if (props.options.length === 0) return;
		const container = containerRef;
		if (!container) return;
		queueMicrotask(() => {
			const selected = container.querySelector<HTMLElement>('[data-voice-selected]');
			if (!selected) return;
			container.scrollTo({
				top: selected.offsetTop - container.clientHeight / 2 + selected.clientHeight / 2,
				behavior: 'smooth',
			});
		});
	});

	return (
		<div
			ref={containerRef}
			class="thin-scrollbar relative h-[380px] overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50 p-2"
		>
			<Show
				when={!props.loading}
				fallback={
					<div class="flex flex-col gap-2 p-1" aria-hidden="true">
						<For each={[85, 65, 75, 60, 80]}>
							{(width) => <div class="h-12 animate-pulse rounded-xl bg-zinc-200/70" style={{ width: `${width}%` }} />}
						</For>
					</div>
				}
			>
				<Show
					when={props.options.length > 0}
					fallback={
						<div class="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
							<i class="bi bi-mic-mute text-3xl text-zinc-400" />
							<p class="text-lg text-zinc-500">{props.emptyText}</p>
						</div>
					}
				>
					<fieldset class="m-0 flex flex-col gap-1 border-0 p-0">
						<legend class="sr-only">{props.label}</legend>
						<For each={props.options}>
							{(option) => {
								const selected = () => props.selectedId === option.id;
								return (
									<label
										data-voice-selected={selected() ? '' : undefined}
										class={cn(
											'flex min-h-14 cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-colors',
											'focus-within:ring-2 focus-within:ring-blue-400',
											selected() ? 'bg-blue-50' : 'hover:bg-zinc-100',
										)}
									>
										<input
											type="radio"
											name={props.name}
											value={option.id}
											checked={selected()}
											onChange={() => props.onSelect(option.id)}
											class="sr-only"
										/>
										<span
											class={cn(
												'grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition-all',
												selected()
													? 'border-blue-600 bg-blue-600 text-white'
													: 'border-zinc-300 bg-white text-transparent',
											)}
										>
											<i class="bi bi-check-lg text-base" />
										</span>
										<span
											class={cn(
												'flex min-w-0 flex-1',
												props.chipPlacement === 'below'
													? 'flex-col items-start gap-1'
													: 'flex-wrap items-center gap-x-2 gap-y-1',
											)}
										>
											<span
												class={cn('text-lg leading-snug font-medium', selected() ? 'text-blue-900' : 'text-zinc-800')}
											>
												{option.name}
											</span>
											<Show when={option.chips?.length}>
												<span class="flex flex-wrap items-center gap-1.5">
													<For each={option.chips}>
														{(chip) => (
															<span
																class={cn(
																	'whitespace-nowrap',
																	props.chipVariant === 'code'
																		? 'rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-500'
																		: 'rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-xs text-zinc-600',
																)}
															>
																{chip}
															</span>
														)}
													</For>
												</span>
											</Show>
										</span>
									</label>
								);
							}}
						</For>
					</fieldset>
				</Show>
			</Show>
		</div>
	);
};

export default VoiceList;
