import { A, useNavigate } from '@solidjs/router';
import { createSignal, Show } from 'solid-js';
import api from '@/lib/api';

function Page() {
	const navigate = useNavigate();
	const [email, setEmail] = createSignal('');
	const [googleUrl, setGoogleUrl] = createSignal<string | null>(null);

	const loadGoogleUrl = async () => {
		const response = await api.auth.oauth.getOAuthUrls(window.location.origin);
		if (response.google) {
			setGoogleUrl(response.google);
		}
	};

	loadGoogleUrl();

	const handleContinue = () => {
		if (email().trim()) {
			navigate(`/login/email?email=${encodeURIComponent(email().trim())}`);
		}
	};

	const handleGoogleLogin = () => {
		const url = googleUrl();
		if (url) {
			window.location.assign(url);
		}
	};

	const handleKeyPress = (e: KeyboardEvent) => {
		if (e.key === 'Enter') {
			handleContinue();
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
					<h1 class="text-2xl font-bold tracking-tight text-gray-900">Sign in to FreeSpeech</h1>
				</div>

				{/* Card */}
				<div class="rounded-2xl border border-gray-200 p-8">
					{/* Email */}
					<label class="mb-1.5 block text-sm font-semibold text-gray-900">Email</label>
					<input
						class="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
						type="email"
						placeholder="Your email address"
						value={email()}
						onInput={(e) => setEmail(e.currentTarget.value)}
						onKeyPress={handleKeyPress}
					/>

					{/* Continue */}
					<button
						onClick={handleContinue}
						disabled={!email().trim()}
						class="mt-4 w-full cursor-pointer rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
					>
						<span class="pointer-events-none select-none">Continue</span>
					</button>

					{/* Divider */}
					<div class="my-6 flex items-center gap-4">
						<div class="h-px flex-1 bg-gray-200" />
						<span class="text-xs font-medium text-gray-400">OR</span>
						<div class="h-px flex-1 bg-gray-200" />
					</div>

					{/* Google Button */}
					<button
						onClick={handleGoogleLogin}
						disabled={!googleUrl()}
						class="flex w-full cursor-pointer items-center justify-center gap-3 rounded-lg border border-gray-200 px-4 py-3 font-medium text-gray-700 transition-all hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
					>
						<Show
							when={googleUrl()}
							fallback={
								<div class="pointer-events-none h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
							}
						>
							<img
								class="pointer-events-none select-none"
								src="https://cdn.iconscout.com/icon/free/png-256/free-google-1772223-1507807.png"
								width={20}
								height={20}
								alt="Google"
							/>
						</Show>
						<span class="pointer-events-none select-none">Continue with Google</span>
					</button>

					{/* Footer inside card */}
					<p class="mt-8 text-center text-sm text-gray-500">
						Don't have an account?{' '}
						<A href="/register" class="font-medium text-blue-600 hover:text-blue-500">
							Sign up
						</A>
					</p>
				</div>
			</div>
		</main>
	);
}

export default Page;
