import { A } from '@solidjs/router';

export default function PrivacyPage() {
	return (
		<main class="mx-auto max-w-3xl space-y-5 px-6 py-16 text-zinc-900">
			<A href="/" class="text-blue-600">
				FreeSpeech AAC
			</A>
			<h1 class="text-3xl font-bold">Privacy Policy</h1>
			<p>
				<a class="text-blue-600 underline" href="https://freespeechaac.com/privacy">
					Read the FreeSpeech AAC privacy policy
				</a>
				.
			</p>
			<h2 class="text-xl font-semibold">Storage on this device</h2>
			<p>
				V2 saves boards, images, account settings, editor drafts, and your last communication page and sentence on this
				device. This lets saved boards open without waiting for an internet connection.
			</p>
			<p>
				Saved changes sync to your account when connected. Unfinished editor drafts stay on this device until you choose
				Save. Signing out removes the saved boards and drafts from this device.
			</p>
			<A href="/app/dashboard/profile" class="text-blue-600 underline">
				Account settings
			</A>
		</main>
	);
}
