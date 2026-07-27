import { A, useLocation } from '@solidjs/router';
import { createMemo, Show } from 'solid-js';
import { user } from '@/lib/state';

export default function DashboardHeader() {
	const location = useLocation();

	const profileUrl = createMemo(() => {
		const profileImgUrl = user()?.profileImgUrl;
		if (!profileImgUrl) return '';
		// External URLs (e.g., Google profile pics) need to be proxied to avoid CORS issues
		if (profileImgUrl.startsWith('http')) {
			return `${import.meta.env.VITE_API_URL}/image-proxy?url=${encodeURIComponent(profileImgUrl)}`;
		}
		return `${import.meta.env.VITE_R2_URL}${profileImgUrl}`;
	});

	const getUserInitials = () => {
		const name = user()?.name;
		if (!name) return '';
		const names = name.split(' ');
		if (names.length === 1) return names[0].charAt(0);
		return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
	};

	const links = [
		{
			name: 'Your Projects',
			icon: 'grid',
			path: '/app/dashboard/projects',
		},
		{
			name: 'Starter Templates',
			icon: 'collection',
			path: '/app/dashboard/templates',
		},
		{
			name: 'Application Settings',
			icon: 'sliders',
			path: '/app/dashboard/settings',
		},
		{
			name: 'Voice Settings',
			path: '/app/dashboard/settings/voice',
			hidden: true,
		},
		{
			name: 'Behavior Settings',
			path: '/app/dashboard/settings/behavior',
			hidden: true,
		},
		{
			name: 'Your Profile',
			path: '/app/dashboard/profile',
			hidden: true,
		},
	];

	return (
		<div class="flex shrink-0 touch-none items-center gap-2 bg-zinc-900 font-light text-zinc-100">
			{links.map((link) => (
				<Show when={!link.hidden}>
					<A
						href={link.path}
						class={`${
							location.pathname.startsWith(link.path)
								? 'border-zinc-600'
								: 'border-zinc-900 text-zinc-400 hover:text-zinc-200'
						} flex items-center gap-4 border-b-4 p-3 px-4 transition-colors`}
					>
						<Show when={link.icon}>
							<i class={`bi bi-${link.icon} text-lg`}></i>
						</Show>
						<span class="text-base">{link.name}</span>
					</A>
				</Show>
			))}
			<div class="flex-1"></div>
			<A href="/app/dashboard/profile" class="px-4">
				<Show
					when={user()?.profileImgUrl}
					fallback={
						<p class="grid h-[40px] w-[40px] place-items-center rounded-full bg-blue-500 text-xs font-bold text-white">
							{getUserInitials()}
						</p>
					}
				>
					<img src={profileUrl()} alt="profile" class="h-[40px] w-[40px] rounded-full bg-zinc-700 object-cover" />
				</Show>
			</A>
		</div>
	);
}
