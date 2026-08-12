// Single source of truth for the settings sections. The settings index builds its cards from
// this list and each subpage header reuses the same icon, colours, and tagline, so a section's
// identity cannot drift between the two screens.

export type SettingsSection = {
	href: string;
	title: string;
	tagline: string;
	icon: string;
	/** Icon badge colours, shared by the index card and the subpage header badge. */
	iconClass: string;
	/** Hover treatments are full literal strings so Tailwind's scanner sees every class. */
	cardHoverClass: string;
	labelHoverClass: string;
};

export const SETTINGS_SECTIONS = {
	voice: {
		href: '/app/dashboard/settings/voice',
		title: 'Voice',
		tagline: 'How FreeSpeech speaks out loud',
		icon: 'bi bi-volume-up-fill',
		iconClass: 'bg-blue-100 text-blue-500',
		cardHoverClass: 'hover:border-blue-200 hover:bg-blue-50',
		labelHoverClass: 'group-hover:text-blue-500',
	},
	behavior: {
		href: '/app/dashboard/settings/behavior',
		title: 'Behavior',
		tagline: 'What happens when tiles are tapped',
		icon: 'bi bi-gear-wide-connected',
		iconClass: 'bg-pink-100 text-pink-500',
		cardHoverClass: 'hover:border-pink-200 hover:bg-pink-50',
		labelHoverClass: 'group-hover:text-pink-500',
	},
	accessControls: {
		href: '/app/dashboard/settings/access-controls',
		title: 'Access Controls',
		tagline: 'Control editing and shared board access',
		icon: 'bi bi-lock-fill',
		iconClass: 'bg-amber-100 text-amber-500',
		cardHoverClass: 'hover:border-amber-200 hover:bg-amber-50',
		labelHoverClass: 'group-hover:text-amber-500',
	},
	appearance: {
		href: '/app/dashboard/settings/appearance',
		title: 'Appearance',
		tagline: 'How tiles look on every board',
		icon: 'bi bi-palette-fill',
		iconClass: 'bg-purple-100 text-purple-500',
		cardHoverClass: 'hover:border-purple-200 hover:bg-purple-50',
		labelHoverClass: 'group-hover:text-purple-500',
	},
} satisfies Record<string, SettingsSection>;
