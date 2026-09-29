import { A } from '@solidjs/router';

export default function TermsPage() {
	return (
		<main class="mx-auto max-w-3xl space-y-5 px-6 py-16 text-zinc-900">
			<A href="/" class="text-blue-600">
				FreeSpeech AAC
			</A>
			<h1 class="text-3xl font-bold">Terms of Service</h1>
			<p>
				<a class="text-blue-600 underline" href="https://freespeechaac.com/tos">
					Read the FreeSpeech AAC terms of service
				</a>
				.
			</p>
			<A href="/privacy" class="text-blue-600 underline">
				Privacy Policy
			</A>
		</main>
	);
}
