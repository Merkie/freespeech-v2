import { A, useNavigate, useSearchParams } from '@solidjs/router';
import { createSignal, Show } from 'solid-js';
import api from '@/lib/api';

function Page() {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();

	// useSearchParams widens repeated keys to string[], so take the first value.
	const tokenParam = Array.isArray(searchParams.token) ? searchParams.token[0] : searchParams.token;
	const token = () => tokenParam ?? '';

	const [password, setPassword] = createSignal('');
	const [confirmPassword, setConfirmPassword] = createSignal('');
	const [error, setError] = createSignal('');
	const [done, setDone] = createSignal(false);
	const [isSubmitting, setIsSubmitting] = createSignal(false);

	const submit = async () => {
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
			const data = await api.auth.resetPassword({ token: token(), password: password() });
			if (data.success) {
				setDone(true);
				// The old link stops verifying the moment the hash changes, so there is nothing to
				// clean up — just send them to sign in with the new password.
				setTimeout(() => navigate('/login/email', { replace: true }), 2500);
				return;
			}
			setError(data.error || 'An unknown error occurred');
		} catch {
			setError('An error occurred. Please try again.');
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleKeyPress = (e: KeyboardEvent) => {
		if (e.key === 'Enter' && !isSubmitting()) submit();
	};

	return (
		<main class="flex min-h-screen items-start justify-center bg-white px-4 pt-[12vh]">
			<div class="w-full max-w-md">
				<div class="mb-8 text-center">
					<A href="/" class="mb-5 inline-block">
						<img src="/logo.png" class="mx-auto h-14 w-14" alt="FreeSpeech AAC Logo" />
					</A>
					<h1 class="text-2xl font-bold tracking-tight text-gray-900">Choose a new password</h1>
				</div>

				<div class="rounded-2xl border border-gray-200 p-8">
					<Show
						when={token()}
						fallback={
							<div class="flex flex-col gap-4 text-center">
								<i class="bi bi-exclamation-triangle text-5xl text-amber-500" />
								<p class="text-gray-900">This reset link is missing its token.</p>
								<p class="text-sm text-gray-500">Request a new link and try again.</p>
								<A href="/login/forgot-password" class="font-medium text-blue-600 hover:text-blue-500">
									Send a new reset link
								</A>
							</div>
						}
					>
						<Show
							when={!done()}
							fallback={
								<div class="flex flex-col gap-4 text-center">
									<i class="bi bi-check-circle text-5xl text-green-600" />
									<p class="text-gray-900">Your password has been changed.</p>
									<p class="text-sm text-gray-500">Taking you to sign in...</p>
								</div>
							}
						>
							<div class="space-y-4">
								<div>
									<label class="mb-1.5 block text-sm font-semibold text-gray-900" for="new-password">
										New password
									</label>
									<input
										id="new-password"
										class="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
										type="password"
										placeholder="At least 8 characters"
										value={password()}
										onInput={(e) => setPassword(e.currentTarget.value)}
										onKeyPress={handleKeyPress}
									/>
								</div>
								<div>
									<label class="mb-1.5 block text-sm font-semibold text-gray-900" for="confirm-new-password">
										Confirm new password
									</label>
									<input
										id="confirm-new-password"
										class="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
										type="password"
										placeholder="Re-enter your new password"
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
								type="button"
								onClick={submit}
								disabled={isSubmitting()}
								class="mt-6 w-full cursor-pointer rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
							>
								<span class="pointer-events-none select-none">{isSubmitting() ? 'Saving...' : 'Change password'}</span>
							</button>
						</Show>
					</Show>

					<p class="mt-8 text-center text-sm text-gray-500">
						<A href="/login/email" class="font-medium text-blue-600 hover:text-blue-500">
							&larr; Back to sign in
						</A>
					</p>
				</div>
			</div>
		</main>
	);
}

export default Page;
