import { createSignal, type Component, createMemo } from 'solid-js';
import { speakText } from '@/lib/speak';
import { voiceEngineStatus } from '@/lib/state';

const TestVoice: Component = () => {
  const [voiceTestText, setVoiceTestText] = createSignal(
    'This is what your voice will sound like inside the application.'
  );

  const buttonText = createMemo(() => {
    const status = voiceEngineStatus();
    const opts = {
      ready: 'Speak',
      synthesizing: 'Synthesizing speech...',
      speaking: 'Speaking...',
      failed: 'Voice engine failed',
    };
    return opts[status];
  });

  const isDisabled = createMemo(() => {
    const status = voiceEngineStatus();
    return !['ready', 'failed'].includes(status);
  });

  return (
    <div class="mt-4 flex flex-col gap-4">
      <p class="text-3xl text-zinc-800">Test voice:</p>
      <div class="flex items-center gap-4">
        <button
          onClick={() => speakText(voiceTestText())}
          disabled={isDisabled()}
          class={`flex w-96 items-center justify-center gap-2 rounded-md p-4 text-lg font-semibold text-white shadow-sm ${
            voiceEngineStatus() === 'failed' ? 'bg-red-500' : 'bg-blue-600'
          }`}
        >
          <i class="bi bi-volume-up text-xl"></i>
          <span>{buttonText()}</span>
        </button>
        <div class="relative flex max-w-[700px] flex-1">
          <input
            value={voiceTestText()}
            onInput={(e) => setVoiceTestText(e.currentTarget.value)}
            type="text"
            class="flex-1 rounded-md border border-zinc-200 bg-white p-4 text-lg shadow-sm ring-blue-200 outline-none focus:ring-2"
          />
          <p class="absolute -top-[30px] left-0 text-zinc-700">
            Testing sentence:
          </p>
        </div>
      </div>
    </div>
  );
};

export default TestVoice;
