import { type Component, createEffect, createSignal, Show } from 'solid-js';
import api from '@/lib/api';
import { setUser, user } from '@/lib/state';

interface ElevenLabsPersonalKeyProps {
	apiKey: string;
	usePersonalElevenLabsKey: boolean;
}

const ElevenLabsPersonalKey: Component<ElevenLabsPersonalKeyProps> = (props) => {
	const [usePersonalKey, setUsePersonalKey] = createSignal(props.usePersonalElevenLabsKey);
	const [elevenLabsApiKey, setElevenLabsApiKey] = createSignal(props.apiKey);
	const [showKey, setShowKey] = createSignal(false);
	let inputRef: HTMLInputElement | undefined;

	createEffect(async () => {
		await api.user.update({
			elevenLabsApiKey: elevenLabsApiKey(),
			usePersonalElevenLabsKey: usePersonalKey(),
		});
		// Update user state
		const currentUser = user();
		if (currentUser) {
			setUser({
				...currentUser,
				elevenLabsApiKey: elevenLabsApiKey(),
				usePersonalElevenLabsKey: usePersonalKey(),
			});
		}
	});

	const handleToggle = async () => {
		setUsePersonalKey(!usePersonalKey());
		await api.user.update({
			usePersonalElevenLabsKey: usePersonalKey(),
		});
	};

	const handleShowKey = async () => {
		if (showKey()) return;

		setShowKey(true);

		await new Promise((resolve) => setTimeout(resolve, 50));

		if (inputRef) {
			inputRef.select();
			inputRef.setSelectionRange(elevenLabsApiKey().length, elevenLabsApiKey().length);
		}
	};

	return (
		<>
			<div class="flex flex-col">
				<div class="flex items-center gap-4">
					<p class="text-3xl text-zinc-800">Use personal ElevenLabs key:</p>
					<button
						aria-label={`Turn ${usePersonalKey() ? 'off' : 'on'} personal ElevenLabs key`}
						onClick={handleToggle}
						class={`relative w-[48px] scale-[120%] rounded-full p-1 shadow-sm transition-all ${
							usePersonalKey() ? 'bg-green-500' : 'bg-zinc-300'
						}`}
					>
						<div
							style={{
								transform: `translateX(${!usePersonalKey() ? '0' : '100%'})`,
							}}
							class="h-[20px] w-[20px] rounded-full bg-white shadow-sm transition-all"
						></div>
					</button>
				</div>

				<p class="mt-2 max-w-[750px] text-zinc-800">
					Using a personal API key helps reduce our costs and it allows you to create custom AI voices based on short
					audio clips. Please visit{' '}
					<a class="text-blue-600 underline" target="_blank" href="https://elevenlabs.io/" rel="noopener">
						ElevenLabs.io
					</a>{' '}
					to learn more.
				</p>
			</div>

			<Show when={usePersonalKey()}>
				<div class="flex flex-col gap-4">
					<p class="text-3xl text-zinc-800">ElevenLabs API Key:</p>

					<button
						onClick={handleShowKey}
						class="flex max-w-[750px] items-center rounded-md border border-zinc-200 bg-white shadow-sm ring-blue-200 focus-within:ring-2"
					>
						<Show
							when={showKey()}
							fallback={
								<p
									class={`text-select-none flex-1 p-4 text-left text-lg ${
										elevenLabsApiKey().length === 0 ? 'text-transparent' : ''
									}`}
								>
									{(elevenLabsApiKey() || 'xxx').replace(/./g, '•')}
								</p>
							}
						>
							<input
								ref={inputRef}
								onBlur={() => setShowKey(false)}
								class="flex-1 bg-transparent p-4 text-lg outline-none"
								value={elevenLabsApiKey()}
								onInput={(e) => setElevenLabsApiKey(e.currentTarget.value)}
								type="text"
							/>
						</Show>
					</button>
					<p class="max-w-[750px] text-zinc-800">This value is encrypted and stored securely on our servers.</p>
				</div>
			</Show>
		</>
	);
};

export default ElevenLabsPersonalKey;
