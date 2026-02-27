import { A, useNavigate } from '@solidjs/router';
import { createSignal, Show } from 'solid-js';
import api from '@/lib/api';
import { cacheAuthToken } from '@/lib/cache/meta-cache';
import { setUser } from '@/lib/state';

function Page() {
	const navigate = useNavigate();
	const [email, setEmail] = createSignal('');
	const [password, setPassword] = createSignal('');
	const [error, setError] = createSignal('');
	const [isSubmitting, setIsSubmitting] = createSignal(false);

	const submitLogin = async () => {
		setError('');
		setIsSubmitting(true);

		try {
			const data = await api.auth.email.login({
				email: email(),
				password: password(),
			});

			if (data.token) {
				localStorage.setItem('token', data.token);
				cacheAuthToken(data.token).catch(() => {});

				// Fetch user data and set in state
				const userData = await api.auth.me(data.token);
				if (userData.user) {
					setUser(userData.user);
				}

				navigate('/app/dashboard/projects', { replace: true });
			} else if (data.error) {
				setError(data.error);
			} else {
				setError('An unknown error occurred');
			}
		} catch {
			setError('An error occurred. Please try again.');
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleKeyPress = (e: KeyboardEvent) => {
		if (e.key === 'Enter' && !isSubmitting()) {
			submitLogin();
		}
	};

	return (
		<main class="grid h-screen place-items-center bg-zinc-100">
			<div class="flex w-full max-w-[800px] flex-col gap-16">
				<div class="text-center">
					<h1 class="text-4xl font-bold text-zinc-900">Login To Free Speech</h1>
				</div>
				<div class="flex flex-col border-y border-zinc-200 bg-zinc-50 p-4 sm:rounded-md sm:border">
					<input
						class="mb-4 rounded-md border border-zinc-300 p-4 text-zinc-800"
						type="email"
						placeholder="Email"
						value={email()}
						onInput={(e) => setEmail(e.currentTarget.value)}
						onKeyPress={handleKeyPress}
					/>
					<input
						class="mb-4 rounded-md border border-zinc-300 p-4 text-zinc-800"
						type="password"
						placeholder="Password"
						value={password()}
						onInput={(e) => setPassword(e.currentTarget.value)}
						onKeyPress={handleKeyPress}
					/>
					<Show when={error()}>
						<small class="mb-4 text-red-500">{error()}</small>
					</Show>
					<button
						onClick={submitLogin}
						disabled={isSubmitting()}
						class="rounded-md bg-blue-600 p-2 text-lg font-bold text-blue-50 disabled:opacity-50"
					>
						{isSubmitting() ? 'Logging in...' : 'Log In'}
					</button>
					<A href="/register" class="mt-4 p-4 text-zinc-400">
						<span class="mr-4">Don't have an account?</span>
						<svg class="inline h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
						</svg>
					</A>
				</div>
			</div>
		</main>
	);
}

export default Page;
