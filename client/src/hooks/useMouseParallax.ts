import { createSignal, onCleanup, onMount } from 'solid-js';

interface ParallaxOffset {
	x: number;
	y: number;
}

interface UseMouseParallaxOptions {
	/** Maximum pixel offset from mouse movement (default: 20) */
	maxOffset?: number;
	/** Maximum pixel offset from scrolling (default: 30) */
	maxScrollOffset?: number;
	/** Smoothing factor for lerping (0-1, higher = faster response, default: 0.1) */
	smoothing?: number;
	/** Whether the effect is enabled (default: true) */
	enabled?: boolean;
}

/**
 * Hook that tracks mouse position and scroll, returning smoothed parallax offsets.
 * Combines mouse movement (X and Y) with scroll position (Y only).
 */
export function useMouseParallax(options: UseMouseParallaxOptions = {}) {
	const { maxOffset = 20, maxScrollOffset = 30, smoothing = 0.1, enabled = true } = options;

	// Target position (where mouse is pointing)
	const [targetX, setTargetX] = createSignal(0);
	const [targetY, setTargetY] = createSignal(0);

	// Target scroll offset
	const [targetScrollY, setTargetScrollY] = createSignal(0);

	// Current smoothed positions
	const [currentX, setCurrentX] = createSignal(0);
	const [currentY, setCurrentY] = createSignal(0);
	const [currentScrollY, setCurrentScrollY] = createSignal(0);

	let animationFrameId: number | null = null;

	const handleMouseMove = (e: MouseEvent) => {
		if (!enabled) return;

		// Calculate normalized position from center (-1 to 1)
		const centerX = window.innerWidth / 2;
		const centerY = window.innerHeight / 2;

		// Normalize to -1 to 1 range
		const normalizedX = (e.clientX - centerX) / centerX;
		const normalizedY = (e.clientY - centerY) / centerY;

		// Clamp to ensure we stay within bounds
		setTargetX(Math.max(-1, Math.min(1, normalizedX)));
		setTargetY(Math.max(-1, Math.min(1, normalizedY)));
	};

	const handleScroll = () => {
		if (!enabled) return;

		// Normalize scroll position (0 at top, 1 after scrolling one viewport height)
		const scrollY = window.scrollY;
		const viewportHeight = window.innerHeight;

		// Normalize to 0-1 range based on first viewport of scrolling
		const normalizedScroll = Math.min(1, scrollY / viewportHeight);

		setTargetScrollY(normalizedScroll);
	};

	const animate = () => {
		// Lerp current positions toward targets
		setCurrentX((prev) => prev + (targetX() - prev) * smoothing);
		setCurrentY((prev) => prev + (targetY() - prev) * smoothing);
		setCurrentScrollY((prev) => prev + (targetScrollY() - prev) * smoothing);

		animationFrameId = requestAnimationFrame(animate);
	};

	onMount(() => {
		if (!enabled) return;

		window.addEventListener('mousemove', handleMouseMove);
		window.addEventListener('scroll', handleScroll, { passive: true });
		animationFrameId = requestAnimationFrame(animate);

		// Initialize scroll position
		handleScroll();
	});

	onCleanup(() => {
		window.removeEventListener('mousemove', handleMouseMove);
		window.removeEventListener('scroll', handleScroll);
		if (animationFrameId !== null) {
			cancelAnimationFrame(animationFrameId);
		}
	});

	/**
	 * Get parallax offset for a specific layer.
	 * @param intensity - How much this layer should move (1 = full movement, 0 = no movement)
	 * @returns Object with x and y pixel offsets (combines mouse and scroll)
	 */
	const getLayerOffset = (intensity: number): ParallaxOffset => {
		const mouseX = currentX() * maxOffset * intensity;
		const mouseY = currentY() * maxOffset * intensity;
		const scrollY = currentScrollY() * maxScrollOffset * intensity;

		return {
			x: mouseX,
			y: mouseY + scrollY,
		};
	};

	return {
		/** Get parallax offset for a layer with given intensity (0-1) */
		getLayerOffset,
		/** Raw normalized X position from mouse (-1 to 1) */
		normalizedX: currentX,
		/** Raw normalized Y position from mouse (-1 to 1) */
		normalizedY: currentY,
		/** Raw normalized scroll position (0 to 1) */
		normalizedScroll: currentScrollY,
	};
}
