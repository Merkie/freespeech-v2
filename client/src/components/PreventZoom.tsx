import { onCleanup, onMount } from 'solid-js';

/**
 * Keeps the app feeling installed rather than browsed: no pinch-zoom, no ctrl+scroll or ctrl+±.
 *
 * The <meta viewport> tag carries `user-scalable=no`, which installed PWAs and Android Chrome
 * honour, but mobile Safari has ignored it in a normal tab since iOS 10 — `gesturestart` is what
 * actually enforces it there. Double-tap zoom, the iOS long-press callout and overscroll bounce
 * are per-element concerns and live in index.css instead.
 *
 * Board text is scaled by the in-app "Tile Text Size" setting and the project's grid dimensions,
 * which reflow rather than forcing users to pan around a magnified page.
 */
export default function PreventZoom() {
	// Safari-only gesture events, so they are registered off the untyped EventTarget interface.
	const zoomTarget = window as unknown as EventTarget;

	const blockGesture = (event: Event) => event.preventDefault();

	const blockPinchWheel = (event: Event) => {
		if ((event as WheelEvent).ctrlKey) event.preventDefault();
	};

	const blockZoomKeys = (event: Event) => {
		const keyEvent = event as KeyboardEvent;
		if (!keyEvent.ctrlKey && !keyEvent.metaKey) return;
		if (['+', '=', '-', '_', '0'].includes(keyEvent.key)) event.preventDefault();
	};

	onMount(() => {
		// Anything that cancels a default has to be registered non-passive or the call is ignored.
		zoomTarget.addEventListener('gesturestart', blockGesture, { passive: false });
		zoomTarget.addEventListener('gesturechange', blockGesture, { passive: false });
		zoomTarget.addEventListener('gestureend', blockGesture, { passive: false });
		zoomTarget.addEventListener('wheel', blockPinchWheel, { passive: false });
		zoomTarget.addEventListener('keydown', blockZoomKeys);
	});

	onCleanup(() => {
		zoomTarget.removeEventListener('gesturestart', blockGesture);
		zoomTarget.removeEventListener('gesturechange', blockGesture);
		zoomTarget.removeEventListener('gestureend', blockGesture);
		zoomTarget.removeEventListener('wheel', blockPinchWheel);
		zoomTarget.removeEventListener('keydown', blockZoomKeys);
	});

	return null;
}
