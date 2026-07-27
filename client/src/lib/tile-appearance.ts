import { localSettings } from './state';
import type { TileImageFit, TileTextOverflow, TileTextSize } from './types';

// Maps the user's display preferences onto Tailwind classes. Kept out of the tile components so
// the board, the sentence bar and anything added later stay visually consistent by construction.

const TEXT_SIZE_CLASS: Record<TileTextSize, string> = {
	small: 'text-sm',
	// 'medium' is text-lg because that is what tiles rendered at before the setting existed.
	medium: 'text-lg',
	large: 'text-2xl',
	'x-large': 'text-4xl',
};

// Wrapped labels need room to grow, so the label row stops being a fixed-height strip.
const TEXT_SIZE_ROW_HEIGHT: Record<TileTextSize, string> = {
	small: 'h-[20px]',
	medium: 'h-[24px]',
	large: 'h-[32px]',
	'x-large': 'h-[44px]',
};

const IMAGE_FIT_CLASS: Record<TileImageFit, string> = {
	contain: 'object-contain',
	cover: 'object-cover',
};

export const TILE_TEXT_SIZE_OPTIONS: { value: TileTextSize; label: string }[] = [
	{ value: 'small', label: 'Small' },
	{ value: 'medium', label: 'Medium' },
	{ value: 'large', label: 'Large' },
	{ value: 'x-large', label: 'Extra Large' },
];

export const TILE_TEXT_OVERFLOW_OPTIONS: { value: TileTextOverflow; label: string }[] = [
	{ value: 'truncate', label: 'Truncate' },
	{ value: 'wrap', label: 'Word wrap' },
];

export const TILE_IMAGE_FIT_OPTIONS: { value: TileImageFit; label: string }[] = [
	{ value: 'contain', label: 'Contain' },
	{ value: 'cover', label: 'Cover' },
];

export function tileTextSizeClass(): string {
	return TEXT_SIZE_CLASS[localSettings().tileTextSize] ?? TEXT_SIZE_CLASS.medium;
}

export function tileTextRowHeightClass(): string {
	return TEXT_SIZE_ROW_HEIGHT[localSettings().tileTextSize] ?? TEXT_SIZE_ROW_HEIGHT.medium;
}

export function tileTextWraps(): boolean {
	return localSettings().tileTextOverflow === 'wrap';
}

export function tileImageFitClass(): string {
	return IMAGE_FIT_CLASS[localSettings().tileImageFit] ?? IMAGE_FIT_CLASS.contain;
}
