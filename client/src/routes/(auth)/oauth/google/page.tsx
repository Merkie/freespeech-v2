import { A, useNavigate, useSearchParams } from '@solidjs/router';
import { createSignal, onMount, Show } from 'solid-js';
import api from '@/lib/api';
import { cacheAuthToken, cacheAuthUser } from '@/lib/cache/meta-cache';
import { setSessionStatus, setUser } from '@/lib/state';

function Page() {
	const [searchParams] = useSearchParams();
	const navigate = useNavigate();
	const [error, setError] = createSignal<string | null>(null);

	onMount(async () => {
		try {
			if (!searchParams.code) {
				setError('No authorization code received');
				return;
			}

			const response = await api.auth.oauth.google(window.location.origin, window.location.search);

			if (!response.token) {
				setError('No token received from server');
				return;
			}

			localStorage.setItem('token', response.token);
			cacheAuthToken(response.token).catch(() => {});

			const userData = await api.auth.me(response.token);

			if (userData.user) {
				setUser(userData.user);
				setSessionStatus('authenticated');
				cacheAuthUser(userData.user).catch(() => {});
			}

			navigate('/app/dashboard/projects', { replace: true });
		} catch (err) {
			console.error('OAuth error:', err);
			setError('Authentication failed. Please try again.');
		}
	});

	return (
		<main class="flex min-h-screen items-start justify-center pt-[12vh] bg-white px-4">
			<div class="w-full max-w-md">
				<div class="mb-8 text-center">
					<img src="/logo.png" class="mx-auto h-14 w-14" alt="FreeSpeech AAC Logo" />
				</div>

				<div class="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
					<Show
						when={error()}
						fallback={
							<div class="flex flex-col items-center gap-4 py-4">
								<div class="h-8 w-8 animate-spin rounded-full border-[3px] border-blue-200 border-t-blue-600" />
								<div>
									<p class="text-center font-medium text-gray-900">Completing sign in...</p>
									<p class="mt-1 text-center text-sm text-gray-500">One moment please</p>
								</div>
							</div>
						}
					>
						<div class="flex flex-col items-center gap-4 py-4">
							<div class="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
								<svg
									class="h-6 w-6 text-red-600"
									fill="none"
									viewBox="0 0 24 24"
									stroke-width="2"
									stroke="currentColor"
								>
									<path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
								</svg>
							</div>
							<div>
								<p class="text-center font-medium text-gray-900">{error()}</p>
								<p class="mt-3 text-center">
									<A href="/login" class="text-sm font-medium text-blue-600 hover:text-blue-500">
										Return to sign in
									</A>
								</p>
							</div>
						</div>
					</Show>
				</div>
			</div>
		</main>
	);
}

export default Page;
