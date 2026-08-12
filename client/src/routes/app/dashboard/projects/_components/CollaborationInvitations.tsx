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

export default function CollaborationInvitations(props: CollaborationInvitationsProps) {
	const [expandedId, setExpandedId] = createSignal<string | null>(null);
	const [respondingId, setRespondingId] = createSignal<string | null>(null);
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
		if (respondingId()) return;
		setRespondingId(invitation.id);
		setError('');
		try {
			const response = await api.project.respondToInvitation(invitation.id, action);
			if (!response.success) throw new Error(response.error || 'Could not respond to the invitation.');
			mutate((current) => current?.filter((item) => item.id !== invitation.id));
			setExpandedId(null);
			if (action === 'accept') await props.onAccepted();
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Could not respond to the invitation.');
		} finally {
			setRespondingId(null);
		}
	};

	return (
		<Show when={(invitations()?.length ?? 0) > 0}>
			<div class="mx-8 mt-6 overflow-hidden rounded-xl border border-sky-600 bg-sky-500/10 shadow-sm">
				<div class="flex items-center gap-3 border-b border-sky-600/30 px-4 py-3 text-sky-950">
					<div class="grid h-9 w-9 place-items-center rounded-full bg-sky-600 text-white">
						<i class="bi bi-people-fill" />
					</div>
					<div>
						<p class="font-semibold">Board collaboration invitation</p>
						<p class="text-sm text-sky-900/70">
							You have{' '}
							{(invitations()?.length ?? 0) === 1 ? 'a board invitation' : `${invitations()?.length} board invitations`}
							.
						</p>
					</div>
				</div>

				<div class="divide-y divide-sky-600/20">
					<For each={invitations()}>
						{(invitation) => {
							const ownerImage = () => resolveProfileImageUrl(invitation.owner.profileImgUrl);
							const expanded = () => expandedId() === invitation.id;
							return (
								<div class="px-4 py-3">
									<button
										type="button"
										onClick={() => setExpandedId(expanded() ? null : invitation.id)}
										class="flex w-full items-center gap-3 text-left"
									>
										<Show
											when={ownerImage()}
											fallback={
												<div class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sky-600 text-sm font-bold text-white">
													{initials(invitation.owner.name)}
												</div>
											}
										>
											<img src={ownerImage()!} alt="" class="h-10 w-10 shrink-0 rounded-full object-cover" />
										</Show>
										<div class="min-w-0 flex-1">
											<p class="truncate font-semibold text-sky-950">{invitation.project.name}</p>
											<p class="truncate text-sm text-sky-900/70">Invited by {invitation.owner.name}</p>
										</div>
										<span class="shrink-0 text-sm font-semibold text-sky-700">
											{expanded() ? 'Hide' : 'Review'} <i class={`bi bi-chevron-${expanded() ? 'up' : 'down'} ml-1`} />
										</span>
									</button>

									<Show when={expanded()}>
										<div class="ml-13 mt-3 rounded-lg border border-sky-600/30 bg-white/60 p-3">
											<p class="text-sm text-sky-950">
												Accept to add this shared board to your projects and edit it from your account.
											</p>
											<Show when={invitation.project.description}>
												<p class="mt-1 text-sm text-sky-900/70">{invitation.project.description}</p>
											</Show>
											<div class="mt-3 flex gap-2">
												<button
													type="button"
													onClick={() => respond(invitation, 'accept')}
													disabled={respondingId() === invitation.id}
													class="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
												>
													Accept invitation
												</button>
												<button
													type="button"
													onClick={() => respond(invitation, 'decline')}
													disabled={respondingId() === invitation.id}
													class="rounded-lg border border-sky-700/30 px-4 py-2 text-sm font-semibold text-sky-800 hover:bg-white/70 disabled:opacity-50"
												>
													Decline
												</button>
											</div>
										</div>
									</Show>
								</div>
							);
						}}
					</For>
				</div>

				<Show when={error()}>
					<p class="border-t border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700">{error()}</p>
				</Show>
			</div>
		</Show>
	);
}
