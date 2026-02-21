import { Show, createSignal, onMount, onCleanup } from 'solid-js';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * PWA Install Prompt component
 *
 * Shows a banner prompting users to install the app
 * Only appears when:
 * - The browser supports PWA installation
 * - The app is not already installed
 * - The user hasn't dismissed the prompt in this session
 */
export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    createSignal<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = createSignal(false);
  const [dismissed, setDismissed] = createSignal(false);

  onMount(() => {
    // Check if already dismissed this session
    const wasDismissed = sessionStorage.getItem('pwa-install-dismissed');
    if (wasDismissed) {
      setDismissed(true);
    }

    // Check if already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return;
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show prompt after a delay to not be intrusive
      setTimeout(() => {
        if (!dismissed()) {
          setShowPrompt(true);
        }
      }, 5000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    onCleanup(() => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    });
  });

  const handleInstall = async () => {
    const prompt = deferredPrompt();
    if (!prompt) return;

    await prompt.prompt();
    const { outcome } = await prompt.userChoice;

    if (outcome === 'accepted') {
      setShowPrompt(false);
    }

    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setDismissed(true);
    setShowPrompt(false);
    sessionStorage.setItem('pwa-install-dismissed', 'true');
  };

  return (
    <Show when={showPrompt() && !dismissed()}>
      <div class="fixed bottom-20 left-4 right-4 z-50 mx-auto max-w-md rounded-lg bg-zinc-800 p-4 shadow-xl">
        <div class="flex items-start gap-3">
          <div class="flex-shrink-0">
            <img
              src="/icons/icon-192x192.png"
              alt="FreeSpeech"
              class="h-12 w-12 rounded-lg"
            />
          </div>
          <div class="flex-1">
            <h3 class="text-base font-semibold text-white">
              Install FreeSpeech
            </h3>
            <p class="mt-1 text-sm text-zinc-400">
              Add to your home screen for faster access and offline use.
            </p>
            <div class="mt-3 flex gap-2">
              <button
                onClick={handleInstall}
                class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Install
              </button>
              <button
                onClick={handleDismiss}
                class="rounded-md px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white"
              >
                Not now
              </button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            class="flex-shrink-0 text-zinc-500 hover:text-white"
            aria-label="Dismiss"
          >
            <i class="bi bi-x-lg" />
          </button>
        </div>
      </div>
    </Show>
  );
}
