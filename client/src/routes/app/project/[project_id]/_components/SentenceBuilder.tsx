import { createSignal, For, Show } from 'solid-js';
import {
  sentence,
  setSentence,
  enableSentenceCopyButton,
} from '@/lib/state';
import { speakText } from '@/lib/speak';
import { cn } from '@/lib/cn';

export default function SentenceBuilder() {
  const [copied, setCopied] = createSignal(false);

  const handleSpeak = () => {
    const text = sentence()
      .map((tile) => tile.text)
      .join(' ');
    if (text.trim()) {
      speakText(text);
    }
  };

  const handleClear = () => {
    setSentence([]);
  };

  const handleCopy = () => {
    const text = sentence()
      .map((tile) => tile.text)
      .join(' ');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const removeTile = (index: number) => {
    setSentence((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div class="relative flex min-h-[100px] items-center gap-2 overflow-hidden border-b border-zinc-200 bg-zinc-50 p-2">

      {/* Sentence tiles */}
      <div class="flex h-full flex-1 items-center gap-2 overflow-x-auto">
        <For each={sentence()}>
          {(tile, index) => (
            <button onClick={() => removeTile(index())} class="shrink-0">
              <div
                style={{
                  'background-color': tile.backgroundColor || 'white',
                  'border-color': tile.borderColor || 'black',
                }}
                class="flex h-[70px] w-[100px] flex-col items-center justify-center gap-1 rounded-md border p-1"
              >
                <Show when={tile.image}>
                  <img
                    src={tile.image}
                    alt=""
                    class="h-[40px] w-full object-contain"
                  />
                </Show>
                <p class="w-full truncate text-center text-sm">
                  {tile.displayText || tile.text}
                </p>
              </div>
            </button>
          )}
        </For>
      </div>

      {/* Action buttons */}
      <div class="flex h-full items-center gap-2">
        {/* Copy button (optional) */}
        <Show when={enableSentenceCopyButton()}>
          <button
            onClick={handleCopy}
            class={cn(
              'grid h-[80px] w-[80px] place-items-center rounded-md text-green-50 transition-all',
              copied() ? 'bg-green-400' : 'bg-green-500 hover:bg-green-600'
            )}
          >
            <div class="relative">
              <i class="bi bi-clipboard text-4xl" />
              <i
                class={cn(
                  'bi bi-check absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-2xl transition-transform',
                  copied() ? 'scale-100' : 'scale-0'
                )}
              />
            </div>
          </button>
        </Show>

        {/* Speak button */}
        <button
          onClick={handleSpeak}
          class="grid h-[80px] w-[80px] place-items-center rounded-md bg-blue-500 text-blue-50 hover:bg-blue-600 active:bg-blue-700"
        >
          <i class="bi bi-volume-up-fill text-4xl" />
        </button>

        {/* Clear button */}
        <button
          onClick={handleClear}
          class="grid h-[80px] w-[80px] place-items-center rounded-md bg-red-500 text-red-50 hover:bg-red-600 active:bg-red-700"
        >
          <i class="bi bi-trash-fill text-4xl" />
        </button>
      </div>
    </div>
  );
}
