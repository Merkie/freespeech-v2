import { A } from '@solidjs/router';
import { createSignal, Show } from 'solid-js';
import api from '@/lib/api';

function Page() {
	const [email, setEmail] = createSignal('');
	const [sent, setSent] = createSignal(false);
	const [error, setError] = createSignal('');
	const [isSubmitting, setIsSubmitting] = createSignal(false);

	const submit = async () => {
		if (!email().trim()) return;
		setError('');
		setIsSubmitting(true);

		try {
			await api.auth.forgotPassword({ email: email().trim() });
			// The server answers the same way whether or not the address is registered, so the
			// confirmation here has to be worded to match — it must not imply an account exists.
			setSent(true);
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
					<h1 class="text-2xl font-bold tracking-tight text-gray-900">Reset your password</h1>
				</div>

				<div class="rounded-2xl border border-gray-200 p-8">
					<Show
						when={!sent()}
						fallback={
							<div class="flex flex-col gap-4 text-center">
								<i class="bi bi-envelope-check text-5xl text-blue-600" />
								<p class="text-gray-900">
									If an account exists for <span class="font-semibold">{email()}</span>, a reset link is on its way.
								</p>
								<p class="text-sm text-gray-500">
									The link expires in one hour. Check your spam folder if it does not arrive.
								</p>
							</div>
						}
					>
						<p class="mb-5 text-sm text-gray-600">
							Enter the email address on your account and we'll send you a link to set a new password.
						</p>

						<label class="mb-1.5 block text-sm font-semibold text-gray-900" for="reset-email">
							Email
						</label>
						<input
							id="reset-email"
							class="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
							type="email"
							placeholder="Your email address"
							value={email()}
							onInput={(e) => setEmail(e.currentTarget.value)}
							onKeyPress={handleKeyPress}
						/>

						<Show when={error()}>
							<div class="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error()}</div>
						</Show>

						<button
							type="button"
							onClick={submit}
							disabled={isSubmitting() || !email().trim()}
							class="mt-6 w-full cursor-pointer rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
						>
							<span class="pointer-events-none select-none">{isSubmitting() ? 'Sending...' : 'Send reset link'}</span>
						</button>
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
