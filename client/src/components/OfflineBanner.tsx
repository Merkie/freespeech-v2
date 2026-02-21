import { Show, createSignal, createEffect } from 'solid-js';
import { globalIsOnline } from '@/hooks/useNetworkStatus';

/**
 * Banner that shows when the user is offline
 *
 * - Shows immediately when offline
 * - Shows "Back online" message briefly when reconnected
 * - Dismissible
 */
export default function OfflineBanner() {
  const [showBanner, setShowBanner] = createSignal(false);
  const [wasOffline, setWasOffline] = createSignal(false);
  const [dismissed, setDismissed] = createSignal(false);

  createEffect(() => {
    const online = globalIsOnline();

    if (!online) {
      // User went offline
      setWasOffline(true);
      setShowBanner(true);
      setDismissed(false);
    } else if (wasOffline()) {
      // User came back online
      setShowBanner(true);
      // Hide the "back online" message after 3 seconds
      setTimeout(() => {
        setShowBanner(false);
        setWasOffline(false);
      }, 3000);
    }
  });

  const handleDismiss = () => {
    setDismissed(true);
    setShowBanner(false);
  };

  return (
    <Show when={showBanner() && !dismissed()}>
      <div
        class={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-2 text-sm font-medium ${
          globalIsOnline()
            ? 'bg-green-600 text-white'
            : 'bg-amber-500 text-black'
        }`}
      >
        <div class="flex items-center gap-2">
          <Show
            when={globalIsOnline()}
            fallback={
              <>
                <i class="bi bi-wifi-off" />
                <span>You're offline. Cached boards are still available.</span>
              </>
            }
          >
            <i class="bi bi-wifi" />
            <span>Back online</span>
          </Show>
        </div>
        <button
          onClick={handleDismiss}
          class="rounded p-1 hover:bg-black/10"
          aria-label="Dismiss"
        >
          <i class="bi bi-x-lg" />
        </button>
      </div>
    </Show>
  );
}
