import { createSignal, For, Show, onMount, type Component } from 'solid-js';
import { offlineVoiceUri, setOfflineVoiceUri } from '@/lib/state';

const InternalVoiceSelector: Component = () => {
  const [offlineBrowserVoices, setOfflineBrowserVoices] = createSignal<
    SpeechSynthesisVoice[]
  >([]);
  let voicesContainerRef: HTMLDivElement | undefined;

  const scrollToSelectedVoice = async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));

    const selectedOfflineVoiceDiv = document.getElementById(
      'offline-voice-active'
    );

    if (selectedOfflineVoiceDiv && voicesContainerRef) {
      voicesContainerRef.scrollTo({
        top:
          selectedOfflineVoiceDiv.offsetTop -
          voicesContainerRef.clientHeight / 2,
        behavior: 'smooth',
      });
    }
  };

  onMount(() => {
    setOfflineBrowserVoices(speechSynthesis.getVoices());
    speechSynthesis.onvoiceschanged = () => {
      setOfflineBrowserVoices(speechSynthesis.getVoices());
      scrollToSelectedVoice();
    };

    scrollToSelectedVoice();
  });

  return (
    <div class="flex flex-col">
      <p class="mb-4 text-2xl text-zinc-700">Select internal device voice:</p>
      <div
        class="relative flex h-[400px] w-full flex-col overflow-y-auto rounded-xl border border-zinc-200 bg-white p-4 shadow-md"
        ref={voicesContainerRef}
      >
        <For each={offlineBrowserVoices()}>
          {(voice, index) => (
            <div
              class={`group flex items-center gap-4 rounded-md p-2 px-4 ${
                index() % 2 === 0 ? 'bg-zinc-100' : 'bg-white'
              }`}
              id={
                offlineVoiceUri() === voice.voiceURI
                  ? 'offline-voice-active'
                  : ''
              }
            >
              <button
                aria-label={`Select ${voice.name} voice`}
                onClick={() => setOfflineVoiceUri(voice.voiceURI)}
                class="p-2"
              >
                <div
                  class={`h-[20px] w-[20px] rounded-full ring-zinc-300 ring-offset-4 ${
                    index() % 2 === 0
                      ? 'ring-offset-zinc-100'
                      : 'ring-offset-white'
                  } ${
                    offlineVoiceUri() === voice.voiceURI
                      ? 'bg-blue-600 ring-4'
                      : `ring-2 ${index() % 2 === 0 ? 'bg-zinc-100' : 'bg-white'}`
                  } transition-all`}
                ></div>
              </button>
              <div class="flex flex-1 items-center gap-1">{voice.name}</div>
            </div>
          )}
        </For>
        <Show when={offlineBrowserVoices().length === 0}>
          <p class="absolute top-1/2 left-1/2 block -translate-x-1/2 -translate-y-1/2 text-center text-2xl text-zinc-500">
            No voices available
          </p>
        </Show>
      </div>
    </div>
  );
};

export default InternalVoiceSelector;
