import { A, useNavigate } from '@solidjs/router';
import { type Component, createSignal, Show } from 'solid-js';
import api from '@/lib/api';
import { getDB } from '@/lib/cache/db';
import { uploadFile } from '@/lib/presigned-uploads';
import { resolveProfileImageUrl } from '@/lib/profile-image';
import { endSession } from '@/lib/session';
import { sessionStatus, setUser, user } from '@/lib/state';

const ProfilePage: Component = () => {
	const navigate = useNavigate();
	const [name, setName] = createSignal(user()?.name || '');
	const [isUploadingPicture, setIsUploadingPicture] = createSignal(false);
	const [pictureError, setPictureError] = createSignal('');
	let pictureInput: HTMLInputElement | undefined;

	const onPictureChosen = async (e: Event) => {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		// Reset so picking the same file again still fires a change event.
		input.value = '';
		if (!file || isUploadingPicture()) return;

		setPictureError('');
		setIsUploadingPicture(true);
		try {
			const key = await uploadFile(file);
			if (!key) {
				setPictureError('That image could not be uploaded. Try a different picture.');
				return;
			}
			// The presign endpoint returns a bare key; stored image paths carry a leading slash to
			// match Project.imageUrl.
			const path = `/${key}`;
			await api.user.update({ profileImgUrl: path });
			const currentUser = user();
			if (currentUser) setUser({ ...currentUser, profileImgUrl: path });
		} catch (_err) {
			setPictureError('That image could not be uploaded. Check your connection and try again.');
		} finally {
			setIsUploadingPicture(false);
		}
	};

	const logout = async () => {
		const saved = await (await getDB()).getAll('projectBlobs');
		if (
			saved.some((entry) => entry.dirty || entry.draft) &&
			!confirm('Some edits or drafts exist only on this device. Signing out will remove them. Sign out anyway?')
		)
			return;
		await endSession();
		navigate('/', { replace: true });
	};

	const online = () => sessionStatus() === 'authenticated';
	const [isExporting, setIsExporting] = createSignal(false);
	const [exportError, setExportError] = createSignal('');
	const [deleting, setDeleting] = createSignal(false);
	const [confirmation, setConfirmation] = createSignal('');
	const [deleteError, setDeleteError] = createSignal('');
	const [isDeleting, setIsDeleting] = createSignal(false);
	// /auth/me reports a password as 'redacted'; Google-only accounts have none.
	const hasPassword = () => !!user()?.password;

	const downloadData = async () => {
		setExportError('');
		setIsExporting(true);
		try {
			const file = await api.user.exportData();
			const url = URL.createObjectURL(file);
			const link = document.createElement('a');
			link.href = url;
			link.download = `freespeech-data-${new Date().toISOString().slice(0, 10)}.json`;
			link.click();
			setTimeout(() => URL.revokeObjectURL(url), 1000);
		} catch {
			setExportError('Your data could not be downloaded. Check your connection and try again.');
		} finally {
			setIsExporting(false);
		}
	};

	const deleteAccount = async () => {
		if (!confirmation().trim() || isDeleting()) return;
		setDeleteError('');
		setIsDeleting(true);
		try {
			const result = await api.user.deleteAccount(
				hasPassword() ? { password: confirmation() } : { email: confirmation().trim() },
			);
			if (!result.success) {
				setDeleteError(result.error || 'Your account could not be deleted.');
				return;
			}
			await endSession();
			navigate('/', { replace: true });
		} catch {
			setDeleteError('Your account could not be deleted. Check your connection and try again.');
		} finally {
			setIsDeleting(false);
		}
	};

	const getUserInitials = () => {
		const userName = user()?.name;
		if (!userName) return '';
		const names = userName.split(' ');
		if (names.length === 1) return names[0].charAt(0);
		return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
	};

	const updateUser = async () => {
		await api.user.update({ name: name() });
		// Refresh user data
		const currentUser = user();
		if (currentUser) {
			setUser({ ...currentUser, name: name() });
		}
	};

	const profileUrl = () => resolveProfileImageUrl(user()?.profileImgUrl);

	return (
		<div class="flex h-full justify-center">
			<div class="flex w-[90%] max-w-[1000px] flex-col p-4 sm:flex-row">
				<div class="flex flex-col items-center p-2 sm:w-fit sm:items-start">
					<Show
						when={user()?.profileImgUrl}
						fallback={
							<p class="grid h-[150px] w-[150px] place-items-center rounded-full bg-blue-500 text-3xl font-bold text-blue-50">
								{getUserInitials()}
							</p>
						}
					>
						<img src={profileUrl()} alt="Profile" class="h-[150px] w-[150px] rounded-full bg-white object-cover" />
					</Show>

					<div>
						<p class="mt-2 text-lg font-medium">{user()?.name}</p>
						<p class="items-cetner flex text-sm">
							<span>{user()?.email}</span>
						</p>
					</div>

					<button
						type="button"
						onClick={logout}
						class="mt-2 w-[200px] rounded-md border border-red-500 bg-red-600 p-1 text-sm text-red-50 sm:w-full"
					>
						Logout
					</button>
				</div>

				<div class="flex flex-1 flex-col overflow-y-auto px-2">
					<div class="flex flex-col gap-2">
						<p class="text-lg">Email</p>
						<input
							type="text"
							value={user()?.email}
							disabled={true}
							class="rounded-md border border-zinc-300 p-2 px-4 text-zinc-800 disabled:opacity-75"
						/>

						<p class="text-lg">Name</p>
						<input
							type="text"
							value={name()}
							onInput={(e) => setName(e.currentTarget.value)}
							class="rounded-md border border-zinc-300 p-2 px-4 text-zinc-800"
						/>

						<Show when={name() && name() !== user()?.name}>
							<button
								onClick={updateUser}
								type="submit"
								class="mt-2 rounded-md border border-blue-400 bg-blue-500 p-2 px-4 text-blue-50"
							>
								Submit Changes
							</button>
						</Show>

						<p class="text-lg">Profile Picture</p>
						<button
							type="button"
							onClick={() => pictureInput?.click()}
							disabled={isUploadingPicture()}
							class="rounded-md border border-zinc-300 bg-zinc-200 p-2 px-4 text-zinc-500 transition-all hover:bg-zinc-300 hover:text-zinc-600 disabled:cursor-wait disabled:opacity-60"
						>
							<Show
								when={!isUploadingPicture()}
								fallback={
									<>
										<i class="bi bi-arrow-repeat mr-2 inline-block animate-spin"></i>Uploading...
									</>
								}
							>
								<i class="bi bi-image mr-2"></i>Upload Profile Picture
							</Show>
						</button>
						<input ref={pictureInput} type="file" accept="image/*" onChange={onPictureChosen} class="hidden" />

						<Show when={pictureError()}>
							<p class="text-sm text-red-500">{pictureError()}</p>
						</Show>

						<p class="mt-4 text-lg">Your Data</p>
						<button
							type="button"
							onClick={downloadData}
							disabled={!online() || isExporting()}
							class="rounded-md border border-zinc-300 bg-zinc-200 p-2 px-4 text-zinc-600 transition-all hover:bg-zinc-300 disabled:opacity-60"
						>
							<i class="bi bi-download mr-2" />
							{isExporting() ? 'Preparing download...' : 'Download my data'}
						</button>
						<Show when={exportError()}>
							<p class="text-sm text-red-500">{exportError()}</p>
						</Show>

						<p class="mt-4 text-lg text-red-600">Delete Account</p>
						<Show
							when={deleting()}
							fallback={
								<button
									type="button"
									onClick={() => setDeleting(true)}
									disabled={!online()}
									class="rounded-md border border-red-300 p-2 px-4 text-red-600 transition-all hover:bg-red-50 disabled:opacity-60"
								>
									Delete account
								</button>
							}
						>
							<div class="flex flex-col gap-2 rounded-md border border-red-300 p-4">
								<p class="text-sm text-zinc-700">
									This permanently deletes your account, your boards, and your board sharing. It cannot be undone.
								</p>
								<label class="text-sm text-zinc-700" for="delete-confirmation">
									{hasPassword() ? 'Enter your password to confirm' : `Type ${user()?.email} to confirm`}
								</label>
								<input
									id="delete-confirmation"
									type={hasPassword() ? 'password' : 'email'}
									autocomplete={hasPassword() ? 'current-password' : 'off'}
									value={confirmation()}
									onInput={(e) => setConfirmation(e.currentTarget.value)}
									onKeyDown={(e) => e.key === 'Enter' && deleteAccount()}
									class="rounded-md border border-zinc-300 p-2 px-4 text-zinc-800"
								/>
								<Show when={deleteError()}>
									<p class="text-sm text-red-600">{deleteError()}</p>
								</Show>
								<div class="flex gap-2">
									<button
										type="button"
										onClick={deleteAccount}
										disabled={!confirmation().trim() || isDeleting() || !online()}
										class="rounded-md bg-red-600 p-2 px-4 text-red-50 disabled:opacity-60"
									>
										{isDeleting() ? 'Deleting...' : 'Delete permanently'}
									</button>
									<button
										type="button"
										onClick={() => {
											setDeleting(false);
											setConfirmation('');
											setDeleteError('');
										}}
										class="rounded-md border border-zinc-300 p-2 px-4 text-zinc-700"
									>
										Cancel
									</button>
								</div>
							</div>
						</Show>
						<Show when={!online()}>
							<p class="text-sm text-zinc-500">Connect to the internet to download or delete your data.</p>
						</Show>

						<p class="mt-4 flex gap-4 text-sm text-blue-500">
							<A href="/privacy">Privacy</A>
							<A href="/tos">Terms</A>
						</p>
					</div>
				</div>
			</div>
		</div>
	);
};

export default ProfilePage;
