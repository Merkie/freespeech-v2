import { createResource, createSignal, For, Show } from 'solid-js';
import api from '@/lib/api';
import { resolveProfileImageUrl } from '@/lib/profile-image';
import type { CollaborationInvitation } from '@/lib/types';

interface CollaborationInvitationsProps {
	onAccepted: () => void | Promise<void>;
}

function initials(name: string) {
	return name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase())
		.join('');
}

// One row per pending invitation with Accept/Decline inline, so responding is a single tap.
// Declining discards the invitation (the owner would have to re-invite), so it asks first —
// the same window.confirm pattern the rest of the dashboard uses for destructive actions.
export default function CollaborationInvitations(props: CollaborationInvitationsProps) {
	const [responding, setResponding] = createSignal<{ id: string; action: 'accept' | 'decline' } | null>(null);
	const [error, setError] = createSignal('');
	const [invitations, { mutate }] = createResource(async () => {
		if (!navigator.onLine) return [];
		try {
			return (await api.project.listInvitations()).invitations ?? [];
		} catch {
			return [];
		}
	});

	const respond = async (invitation: CollaborationInvitation, action: 'accept' | 'decline') => {
		if (responding()) return;
		if (action === 'decline' && !window.confirm(`Decline the invitation to "${invitation.project.name}"?`)) return;
		setResponding({ id: invitation.id, action });
		setError('');
		try {
			const response = await api.project.respondToInvitation(invitation.id, action);
			if (!response.success) throw new Error(response.error || 'Could not respond to the invitation.');
			mutate((current) => current?.filter((item) => item.id !== invitation.id));
			if (action === 'accept') await props.onAccepted();
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Could not respond to the invitation.');
		} finally {
			setResponding(null);
		}
	};

	return (
		<Show when={(invitations()?.length ?? 0) > 0}>
			<div class="mx-8 mt-6 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
				<div class="divide-y divide-zinc-100">
					<For each={invitations()}>
						{(invitation) => {
							const ownerImage = () => resolveProfileImageUrl(invitation.owner.profileImgUrl);
							const busy = () => responding()?.id === invitation.id;
							const spinning = (action: 'accept' | 'decline') => busy() && responding()?.action === action;
							return (
								<div class="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-5">
									<div class="flex min-w-0 flex-1 basis-60 items-center gap-3">
										<Show
											when={ownerImage()}
											fallback={
												<div class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sky-500 text-sm font-bold text-white">
													{initials(invitation.owner.name)}
												</div>
											}
										>
											<img src={ownerImage()!} alt="" class="h-10 w-10 shrink-0 rounded-full object-cover" />
										</Show>
										<div class="min-w-0">
											<p class="truncate font-semibold text-zinc-900">{invitation.project.name}</p>
											<p class="truncate text-sm text-zinc-500">
												Invited by {invitation.owner.name}
												<Show when={invitation.project.description}>{` · ${invitation.project.description}`}</Show>
											</p>
										</div>
									</div>
									<div class="ml-auto flex shrink-0 items-center gap-2">
										<button
											type="button"
											onClick={() => respond(invitation, 'decline')}
											disabled={busy()}
											aria-label={`Decline the invitation to ${invitation.project.name}`}
											class="flex items-center gap-2 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-600 transition-all hover:border-zinc-400 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
										>
											<i
												class={`bi ${spinning('decline') ? 'bi-arrow-repeat animate-spin' : 'bi-x-lg'} text-base leading-none`}
											/>
											Decline
										</button>
										<button
											type="button"
											onClick={() => respond(invitation, 'accept')}
											disabled={busy()}
											aria-label={`Accept the invitation to ${invitation.project.name}`}
											class="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
										>
											<i
												class={`bi ${spinning('accept') ? 'bi-arrow-repeat animate-spin' : 'bi-check-lg'} text-base leading-none`}
											/>
											Accept
										</button>
									</div>
								</div>
							);
						}}
					</For>
				</div>

				<Show when={error()}>
					<p class="border-t border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700 sm:px-5">{error()}</p>
				</Show>
			</div>
		</Show>
	);
}
