import { createSignal, For, onMount, Show } from 'solid-js';
import api from '@/lib/api';
import { resolveProfileImageUrl } from '@/lib/profile-image';
import { projectToCollaborate } from '@/lib/state';
import type { CollaborationUser, ProjectCollaborator } from '@/lib/types';

function initials(name: string) {
	return name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase())
		.join('');
}

function Avatar(props: { person: CollaborationUser }) {
	const imageUrl = () => resolveProfileImageUrl(props.person.profileImgUrl);
	return (
		<Show
			when={imageUrl()}
			fallback={
				<div class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sky-500 text-sm font-bold text-white">
					{initials(props.person.name)}
				</div>
			}
		>
			<img src={imageUrl()} alt="" class="h-10 w-10 shrink-0 rounded-full bg-zinc-800 object-cover" />
		</Show>
	);
}

export default function ManageCollaborators() {
	const selectedProject = () => projectToCollaborate();
	const [collaborators, setCollaborators] = createSignal<ProjectCollaborator[]>([]);
	const [email, setEmail] = createSignal('');
	const [candidate, setCandidate] = createSignal<Required<CollaborationUser> | null>(null);
	const [candidateStatus, setCandidateStatus] = createSignal<'pending' | 'accepted' | null>(null);
	const [loading, setLoading] = createSignal(true);
	const [searching, setSearching] = createSignal(false);
	const [saving, setSaving] = createSignal(false);
	const [error, setError] = createSignal('');

	const load = async () => {
		const project = selectedProject();
		if (!project) return;
		const response = await api.project.listCollaborators(project.id);
		if (response.error || !response.collaborators) throw new Error(response.error || 'Could not load collaborators.');
		setCollaborators(response.collaborators);
	};

	onMount(async () => {
		try {
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Could not load collaborators.');
		} finally {
			setLoading(false);
		}
	});

	const handleLookup = async (event: SubmitEvent) => {
		event.preventDefault();
		const project = selectedProject();
		if (!project || !email().trim()) return;

		setError('');
		setCandidate(null);
		setSearching(true);
		try {
			const response = await api.project.lookupCollaborator(project.id, email().trim());
			if (response.error || !response.candidate) throw new Error(response.error || 'No account matches that email.');
			setCandidate(response.candidate);
			setCandidateStatus(response.status ?? null);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Could not find that account.');
		} finally {
			setSearching(false);
		}
	};

	const handleInvite = async () => {
		const project = selectedProject();
		const person = candidate();
		if (!project || !person || saving()) return;

		setSaving(true);
		setError('');
		try {
			const response = await api.project.inviteCollaborator(project.id, person.id);
			if (!response.success) throw new Error(response.error || 'Could not send the invitation.');
			await load();
			setCandidate(null);
			setCandidateStatus(null);
			setEmail('');
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Could not send the invitation.');
		} finally {
			setSaving(false);
		}
	};

	const handleRemove = async (collaborator: ProjectCollaborator) => {
		const project = selectedProject();
		if (!project || saving()) return;
		const verb = collaborator.status === 'pending' ? 'Cancel the invitation for' : 'Remove';
		if (!window.confirm(`${verb} ${collaborator.user.name}?`)) return;

		setSaving(true);
		setError('');
		try {
			const response = await api.project.removeCollaborator(project.id, collaborator.user.id);
			if (!response.success) throw new Error(response.error || 'Could not remove this person.');
			setCollaborators((current) => current.filter((item) => item.id !== collaborator.id));
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Could not remove this person.');
		} finally {
			setSaving(false);
		}
	};

	return (
		<div class="flex max-h-[65vh] flex-col gap-5 overflow-y-auto pr-1">
			<div>
				<p class="text-sm text-zinc-400">Invite someone to collaborate on</p>
				<p class="text-lg font-semibold text-white">{selectedProject()?.name}</p>
			</div>

			<form onSubmit={handleLookup} class="flex gap-2">
				<label class="sr-only" for="collaborator-email">
					Collaborator email
				</label>
				<input
					id="collaborator-email"
					type="email"
					value={email()}
					onInput={(event) => setEmail(event.currentTarget.value)}
					placeholder="name@example.com"
					autocomplete="email"
					class="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white outline-none transition-colors placeholder:text-zinc-500 focus:border-sky-500"
				/>
				<button
					type="submit"
					disabled={!email().trim() || searching()}
					class="rounded-lg bg-sky-600 px-4 py-2 font-medium text-white transition-colors hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{searching() ? 'Finding…' : 'Find'}
				</button>
			</form>

			<Show when={candidate()} keyed>
				{(person) => (
					<div class="rounded-xl border border-sky-700/60 bg-sky-950/40 p-3">
						<div class="flex items-center gap-3">
							<Avatar person={person} />
							<div class="min-w-0 flex-1">
								<p class="truncate font-semibold text-white">{person.name}</p>
								<p class="truncate text-sm text-zinc-400">{person.email}</p>
							</div>
						</div>
						<div class="mt-3 flex items-center justify-between gap-3">
							<p class="text-sm text-sky-200">
								{candidateStatus() === 'accepted'
									? 'Already a collaborator'
									: candidateStatus() === 'pending'
										? 'Invitation already pending'
										: 'Is this the person you want to invite?'}
							</p>
							<Show when={!candidateStatus()}>
								<button
									type="button"
									onClick={handleInvite}
									disabled={saving()}
									class="shrink-0 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
								>
									Yes, send invite
								</button>
							</Show>
						</div>
					</div>
				)}
			</Show>

			<Show when={error()}>
				<p class="rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-300">{error()}</p>
			</Show>

			<div class="border-t border-zinc-700 pt-4">
				<p class="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">People with access</p>
				<Show when={!loading()} fallback={<p class="py-3 text-sm text-zinc-500">Loading collaborators…</p>}>
					<Show
						when={collaborators().length > 0}
						fallback={<p class="py-3 text-sm text-zinc-500">No one has been invited yet.</p>}
					>
						<div class="flex flex-col gap-2">
							<For each={collaborators()}>
								{(collaborator) => (
									<div class="flex items-center gap-3 rounded-lg bg-zinc-800 p-3">
										<Avatar person={collaborator.user} />
										<div class="min-w-0 flex-1">
											<p class="truncate font-medium text-white">{collaborator.user.name}</p>
											<p class="truncate text-xs text-zinc-400">
												{collaborator.status === 'pending' ? 'Invitation pending' : 'Collaborator'} ·{' '}
												{collaborator.user.email}
											</p>
										</div>
										<button
											type="button"
											onClick={() => handleRemove(collaborator)}
											disabled={saving()}
											class="rounded-md px-2 py-1 text-sm text-red-300 hover:bg-red-950/50 disabled:opacity-50"
										>
											{collaborator.status === 'pending' ? 'Cancel' : 'Remove'}
										</button>
									</div>
								)}
							</For>
						</div>
					</Show>
				</Show>
			</div>
		</div>
	);
}
