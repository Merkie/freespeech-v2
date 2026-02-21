import { onMount, onCleanup } from 'solid-js';

export default function useOutsideClick(
  elAccessor: () => HTMLElement | undefined | null,
  callback: () => void
) {
  const handleClick = (event: MouseEvent | TouchEvent) => {
    const el = elAccessor();
    if (el && !el.contains(event.target as Node)) {
      callback();
    }
  };

  onMount(() => {
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('touchstart', handleClick);
  });

  onCleanup(() => {
    document.removeEventListener('mousedown', handleClick);
    document.removeEventListener('touchstart', handleClick);
  });
}
