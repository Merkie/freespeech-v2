import { A } from '@solidjs/router';
import { type Component, For } from 'solid-js';
import { cn } from '@/lib/cn';
import OfflineSettingsNotice from './_components/OfflineSettingsNotice';
import { SETTINGS_SECTIONS } from './_components/settings-sections';

const SettingsPage: Component = () => {
	return (
		<>
			<div class="flex flex-col gap-8 p-8 pt-14 pb-6">
				<p class="text-4xl text-zinc-800">Application Settings</p>
				<OfflineSettingsNotice />
			</div>

			<div class="grid grid-cols-1 gap-8 p-8 pb-[200px] md:grid-cols-2">
				<For each={Object.values(SETTINGS_SECTIONS)}>
					{(section) => (
						<A
							href={section.href}
							class={cn(
								'group flex items-center gap-4 rounded-xl border-2 border-zinc-300 p-4 transition-all select-none',
								section.cardHoverClass,
							)}
						>
							<div class={cn('grid h-[70px] w-[70px] place-items-center rounded-lg', section.iconClass)}>
								<i class={cn(section.icon, 'text-[40px]')}></i>
							</div>
							<span class={cn('text-3xl text-zinc-800 transition-all', section.labelHoverClass)}>{section.title}</span>
							<div class="flex-1"></div>
							<i
								class={cn('bi bi-arrow-right-short text-6xl text-zinc-500 transition-all', section.labelHoverClass)}
							></i>
						</A>
					)}
				</For>
			</div>
		</>
	);
};

export default SettingsPage;
