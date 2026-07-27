import { useNavigate } from '@solidjs/router';
import { type Component, createSignal, Show } from 'solid-js';
import api from '@/lib/api';
import { clearCachedAuth } from '@/lib/cache/meta-cache';
import { setSessionStatus, setUser, user } from '@/lib/state';

const ProfilePage: Component = () => {
	const navigate = useNavigate();
	const [_isUploadProfilePictureModalOpen, setIsUploadProfilePictureModalOpen] = createSignal(false);
	const [name, setName] = createSignal(user()?.name || '');

	const logout = async () => {
		localStorage.removeItem('token');
		await clearCachedAuth().catch(() => undefined);
		// The worker caches API responses keyed by URL alone, so they outlive the token unless it is
		// told to drop them. Without this the next account on a shared iPad could be shown the
		// previous one's project list while offline.
		navigator.serviceWorker?.controller?.postMessage({ type: 'CLEAR_API_CACHE' });
		setUser(null);
		setSessionStatus('unauthenticated');
		navigate('/', { replace: true });
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

	const profileUrl = () => {
		const profileImgUrl = user()?.profileImgUrl;
		if (!profileImgUrl) return '';
		// External URLs (e.g., Google profile pics) need to be proxied to avoid CORS issues
		if (profileImgUrl.startsWith('http')) {
			return `${import.meta.env.VITE_API_URL}/image-proxy?url=${encodeURIComponent(profileImgUrl)}`;
		}
		return `${import.meta.env.VITE_R2_URL}${profileImgUrl}`;
	};

	return (
		<>
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
								onClick={() => setIsUploadProfilePictureModalOpen(true)}
								class="rounded-md border border-zinc-300 bg-zinc-200 p-2 px-4 text-zinc-500"
							>
								<i class="bi bi-image mr-2"></i>Upload Profile Picture
							</button>
						</div>
					</div>
				</div>
			</div>

			{/* TODO: Add ModalUploadProfilePicture component */}
			{/* <ModalUploadProfilePicture
        isOpen={isUploadProfilePictureModalOpen()}
        closeModal={() => setIsUploadProfilePictureModalOpen(false)}
      /> */}
		</>
	);
};

export default ProfilePage;
