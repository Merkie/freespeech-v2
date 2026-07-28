import { A, useNavigate, useSearchParams } from '@solidjs/router';
import { createSignal, Show } from 'solid-js';
import api from '@/lib/api';
import { cacheAuthToken, cacheAuthUser } from '@/lib/cache/meta-cache';
import { hydrateAccessControlSettings } from '@/lib/pin';
import { setSessionStatus, setUser } from '@/lib/state';

function Page() {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const [name, setName] = createSignal('');
	// useSearchParams widens repeated keys to string[], so take the first value.
	const emailParam = Array.isArray(searchParams.email) ? searchParams.email[0] : searchParams.email;
	const [email, setEmail] = createSignal(emailParam ?? '');
	const [password, setPassword] = createSignal('');
	const [confirmPassword, setConfirmPassword] = createSignal('');
	const [error, setError] = createSignal('');
	const [isSubmitting, setIsSubmitting] = createSignal(false);

	const submitRegistration = async () => {
		setError('');

		if (password() !== confirmPassword()) {
			setError('Passwords do not match.');
			return;
		}

		if (password().length < 8) {
			setError('Password must be at least 8 characters.');
			return;
		}

		setIsSubmitting(true);

		try {
			const data = await api.auth.email.register({
				email: email(),
				name: name(),
				password: password(),
			});

			if (data.token) {
				localStorage.setItem('token', data.token);
				cacheAuthToken(data.token).catch(() => {});

				const userData = await api.auth.me(data.token);
				if (userData.user) {
					await hydrateAccessControlSettings(userData.user.id);
					setUser(userData.user);
					setSessionStatus('authenticated');
					cacheAuthUser(userData.user).catch(() => {});
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
			submitRegistration();
		}
	};

	return (
		<main class="flex min-h-screen items-start justify-center pt-[12vh] bg-white px-4">
			<div class="w-full max-w-md">
				{/* Logo & Header */}
				<div class="mb-8 text-center">
					<A href="/" class="mb-5 inline-block">
						<img src="/logo.png" class="mx-auto h-14 w-14" alt="FreeSpeech AAC Logo" />
					</A>
					<h1 class="text-2xl font-bold tracking-tight text-gray-900">Complete your account</h1>
				</div>

				{/* Card */}
				<div class="rounded-2xl border border-gray-200 p-8">
					<div class="space-y-4">
						<div>
							<label class="mb-1.5 block text-sm font-semibold text-gray-900">Name</label>
							<input
								class="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
								type="text"
								placeholder="Your name"
								value={name()}
								onInput={(e) => setName(e.currentTarget.value)}
								onKeyPress={handleKeyPress}
							/>
						</div>
						<div>
							<label class="mb-1.5 block text-sm font-semibold text-gray-900">Email</label>
							<input
								class="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
								type="email"
								placeholder="Your email address"
								value={email()}
								onInput={(e) => setEmail(e.currentTarget.value)}
								onKeyPress={handleKeyPress}
							/>
						</div>
						<div>
							<label class="mb-1.5 block text-sm font-semibold text-gray-900">Password</label>
							<input
								class="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
								type="password"
								placeholder="At least 8 characters"
								value={password()}
								onInput={(e) => setPassword(e.currentTarget.value)}
								onKeyPress={handleKeyPress}
							/>
						</div>
						<div>
							<label class="mb-1.5 block text-sm font-semibold text-gray-900">Confirm password</label>
							<input
								class="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
								type="password"
								placeholder="Re-enter your password"
								value={confirmPassword()}
								onInput={(e) => setConfirmPassword(e.currentTarget.value)}
								onKeyPress={handleKeyPress}
							/>
						</div>
					</div>

					<Show when={error()}>
						<div class="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error()}</div>
					</Show>

					<button
						onClick={submitRegistration}
						disabled={isSubmitting()}
						class="mt-6 w-full cursor-pointer rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
					>
						<span class="pointer-events-none select-none">
							{isSubmitting() ? 'Creating account...' : 'Create Account'}
						</span>
					</button>

					<p class="mt-8 text-center text-sm text-gray-500">
						<A href="/register" class="font-medium text-blue-600 hover:text-blue-500">
							&larr; All sign up options
						</A>
					</p>
				</div>
			</div>
		</main>
	);
}

export default Page;
