import { cn } from '@/lib/cn';
import { activeModalId, setActiveModalId } from '@/lib/state';
import { createEffect, createSignal, on } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { MODAL_REGISTRY } from './modal-registry';
import type { ModalIdType } from '@/lib/constants';

const TRANSITION_DURATION = 200;

export default function Modal() {
  const [isVisible, setIsVisible] = createSignal(false);
  const [renderedModalId, setRenderedModalId] = createSignal<ModalIdType | ''>(
    ''
  );

  // Handle modal open/close with animation timing
  createEffect(
    on(activeModalId, (modalId) => {
      if (modalId) {
        // Opening: set the modal content first, then animate in
        setRenderedModalId(modalId);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setIsVisible(true);
          });
        });
      } else {
        // Closing: animate out first, then clear content
        setIsVisible(false);
        setTimeout(() => {
          setRenderedModalId('');
        }, TRANSITION_DURATION);
      }
    })
  );

  const modalConfig = () => {
    const id = renderedModalId();
    return id ? MODAL_REGISTRY[id] : null;
  };

  const modalTitle = () => {
    const title = modalConfig()?.title;
    return typeof title === 'function' ? title() : title;
  };

  const handleBackdropClick = (e: MouseEvent) => {
    if ((e.target as HTMLElement).dataset.backdrop) {
      setActiveModalId('');
    }
  };

  return (
    <div
      data-backdrop="true"
      onClick={handleBackdropClick}
      class={cn(
        'fixed inset-0 z-50 flex items-center justify-center bg-black/75 transition-opacity duration-200',
        {
          'pointer-events-auto select-auto opacity-100': isVisible(),
          'pointer-events-none select-none opacity-0': !isVisible(),
        }
      )}
    >
      <div
        class={cn(
          'relative w-full max-w-md overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-200 shadow-2xl transition-all duration-200',
          {
            'translate-y-0 opacity-100': isVisible(),
            'translate-y-[20px] opacity-0': !isVisible(),
          }
        )}
      >
        {/* Header */}
        <div class="flex items-center justify-between border-b border-zinc-700 px-5 py-4">
          <h2 class="text-lg font-bold text-white">{modalTitle() || ''}</h2>
          <button
            onClick={() => setActiveModalId('')}
            class="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
          >
            <i class="bi bi-x-lg" />
          </button>
        </div>

        {/* Content */}
        <div class="p-5">
          <Dynamic component={modalConfig()?.innerElement} />
        </div>
      </div>
    </div>
  );
}
