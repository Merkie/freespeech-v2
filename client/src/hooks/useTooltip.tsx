import { createSignal, onCleanup } from 'solid-js';
import { Portal } from 'solid-js/web';

// Global state for the singleton tooltip
const [tooltipText, setTooltipText] = createSignal<string | null>(null);
const [position, setPosition] = createSignal({ x: 0, y: 0 });
const [isVisible, setIsVisible] = createSignal(false);
let showTimeout: ReturnType<typeof setTimeout> | null = null;

const showTooltip = (text: string, element: HTMLElement) => {
	if (showTimeout) clearTimeout(showTimeout);

	const rect = element.getBoundingClientRect();
	setPosition({
		x: rect.left + rect.width / 2,
		y: rect.top,
	});
	setTooltipText(text);

	showTimeout = setTimeout(() => {
		setIsVisible(true);
	}, 200);
};

const hideTooltip = () => {
	if (showTimeout) {
		clearTimeout(showTimeout);
		showTimeout = null;
	}
	setIsVisible(false);
	setTooltipText(null);
};

// Ref callback that sets up tooltip handlers on an element
export const tooltip = (text: string) => {
	return (el: HTMLElement) => {
		const onEnter = () => showTooltip(text, el);
		const onLeave = () => hideTooltip();

		el.addEventListener('mouseenter', onEnter);
		el.addEventListener('mouseleave', onLeave);

		onCleanup(() => {
			el.removeEventListener('mouseenter', onEnter);
			el.removeEventListener('mouseleave', onLeave);
		});
	};
};

// Place this once at app root
export function TooltipProvider() {
	return (
		<Portal>
			{tooltipText() && (
				<div
					class="pointer-events-none fixed z-[99999]"
					style={{
						left: `${position().x}px`,
						top: `${position().y}px`,
					}}
				>
					<span
						class="absolute left-1/2 whitespace-nowrap rounded bg-zinc-900 px-2 py-1 text-xs text-zinc-200 shadow-lg transition-[opacity,transform] duration-150"
						style={{
							transform: `translateX(-50%) translateY(${isVisible() ? 'calc(-100% - 8px)' : 'calc(-100% - 5px)'})`,
							opacity: isVisible() ? 1 : 0,
						}}
					>
						{tooltipText()}
					</span>
				</div>
			)}
		</Portal>
	);
}
