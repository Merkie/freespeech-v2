import { createEffect, createRoot, createSignal } from 'solid-js';
import type { ModalIdType } from './constants';
import type {
	AccessControlSettings,
	LocalSettings,
	PageBlob,
	Project,
	ProjectBlob,
	Tile,
	TileBlob,
	TilePosition,
	TilePositionKey,
	User,
} from './types';

// Utility functions for position-based tile identification
export function tilePositionKey(t: TilePosition): TilePositionKey {
	return `${t.x}-${t.y}-${t.page}`;
}

export function parseTilePositionKey(key: TilePositionKey): TilePosition {
	const [x, y, page] = key.split('-').map(Number);
	return { x, y, page };
}

export function findTileByPosition(tiles: Tile[], pos: TilePosition): Tile | undefined {
	return tiles.find((t) => t.x === pos.x && t.y === pos.y && t.page === pos.page);
}

export function findTileByPositionKey(tiles: Tile[], key: TilePositionKey): Tile | undefined {
	const pos = parseTilePositionKey(key);
	return findTileByPosition(tiles, pos);
}

export const [project, setProject] = createSignal<Project>(null as unknown as Project);
export const [projectHomePageId, setProjectHomePageId] = createSignal('');
export const [currentPageId, setCurrentPageId] = createSignal('');
// Trail of previously visited page ids in the current project, most recent last
export const [pageHistory, setPageHistory] = createSignal<string[]>([]);

// --- this is stuff claude code mostly generated ---

// User state
export const [user, setUser] = createSignal<User | null>(null);
export type SessionStatus = 'checking' | 'authenticated' | 'offline' | 'unauthenticated';
export const [sessionStatus, setSessionStatus] = createSignal<SessionStatus>('checking');

// Speech synthesis
export const [isSynthesizingSpeech, setIsSynthesizingSpeech] = createSignal(false);
export const [sentence, setSentence] = createSignal<Tile[]>([]);
export const [loading, setLoading] = createSignal(false);

export const [editingTiles, setEditingTiles] = createSignal(false);
export const [usingOnlineSearch, setUsingOnlineSearch] = createSignal(false);

// Tile editing - array of tile position keys being edited (supports single and multi-select)
// Position keys are in format "x-y-page" (e.g., "0-1-0")
export const [editingTilePositions, setEditingTilePositions] = createSignal<TilePositionKey[]>([]);

// Helper to check if we're editing multiple tiles
export const isBulkEditing = () => editingTilePositions().length > 1;

// Legacy aliases for backwards compatibility during migration
export const editingTileIds = editingTilePositions;
export const setEditingTileIds = setEditingTilePositions;

// Multi-select mode (for mobile - acts like holding shift)
export const [multiSelectMode, setMultiSelectMode] = createSignal(false);

export const [editingPages, setEditingPages] = createSignal(false);
export const [addingPage, setAddingPage] = createSignal(false);

export const [editingProjects, setEditingProjects] = createSignal(false);
export const [addingProject, setAddingProject] = createSignal(false);
export const [projectBeingEdited, setProjectBeingEdited] = createSignal<Project | null>(null);

// Modal state
export const [activeModalId, setActiveModalId] = createSignal<ModalIdType | ''>('');

// Project to optimize (for OptimizeImages modal)
export const [projectToOptimize, setProjectToOptimize] = createSignal<{
	id: string;
	name: string;
} | null>(null);

// Loading states for project/page transitions
export const [projectLoading, setProjectLoading] = createSignal(false);
export const [pageLoading, setPageLoading] = createSignal(false);

// --- Blob state (offline-first sync) ---
export type SyncStatus = 'synced' | 'syncing' | 'dirty' | 'conflict' | 'offline' | 'error';
export const [projectBlob, setProjectBlob] = createSignal<ProjectBlob | null>(null);
export const [syncStatus, setSyncStatus] = createSignal<SyncStatus>('synced');
export const [conflictServerBlob, setConflictServerBlob] = createSignal<ProjectBlob | null>(null);

// Derived helpers — call within tracking scopes for reactivity
const DEFAULT_BG = '#fafafa';
const DEFAULT_BORDER = '#71717a';

function expandTileBlob(t: TileBlob): Tile {
	return {
		x: t.x,
		y: t.y,
		page: t.page,
		text: t.text,
		displayText: t.displayText ?? '',
		backgroundColor: t.backgroundColor ?? DEFAULT_BG,
		borderColor: t.borderColor ?? DEFAULT_BORDER,
		image: t.image ?? '',
		navigation: t.navigation ?? '',
	};
}

export function getPageFromBlob(pageId: string): PageBlob | undefined {
	return projectBlob()?.pages.find((p) => p.id === pageId);
}

export function getCurrentPageTiles(): Tile[] {
	const page = getPageFromBlob(currentPageId());
	if (!page) return [];
	return page.tiles.map(expandTileBlob);
}

export function getProjectPagesFromBlob(): { id: string; name: string }[] {
	const blob = projectBlob();
	if (!blob) return [];
	return blob.pages.map((p) => ({ id: p.id, name: p.name }));
}

// Reset all project-related state when switching projects
export function resetProjectState() {
	setSentence([]);
	setEditingTiles(false);
	setEditingTilePositions([]);
	setMultiSelectMode(false);
	setUsingOnlineSearch(false);
	setEditingPages(false);
	setAddingPage(false);
	setProjectBlob(null);
	setSyncStatus('synced');
	setPageHistory([]);
}

export const [voiceEngineStatus, setVoiceEngineStatus] = createSignal<'ready' | 'speaking' | 'synthesizing' | 'failed'>(
	'ready',
);

// Track which tile is currently speaking (for loading indicator on tile)
// Uses position key format "x-y-page"
export const [speakingTilePosition, setSpeakingTilePosition] = createSignal<TilePositionKey | null>(null);

// Legacy alias for backwards compatibility
export const speakingTileId = speakingTilePosition;
export const setSpeakingTileId = setSpeakingTilePosition;

// Voice settings (persisted to localStorage)
export const [enableThirdPartyVoiceProviders, setEnableThirdPartyVoiceProviders] = createSignal(false);
export const [elevenLabsVoiceId, setElevenLabsVoiceId] = createSignal<string | null>(null);
export const [offlineVoiceUri, setOfflineVoiceUri] = createSignal<string | null>(null);

// Behavior settings (persisted to localStorage)
export const [enableSentenceCopyButton, setEnableSentenceCopyButton] = createSignal(false);

// Account-level access controls. The database is authoritative while this signal is hydrated
// from a per-account IndexedDB cache when the app starts offline.
export const DEFAULT_ACCESS_CONTROL_SETTINGS: AccessControlSettings = {
	enabled: false,
	mode: 'pin',
	pinHash: null,
	pinSalt: null,
	updatedAt: null,
};
export const [accessControlSettings, setAccessControlSettings] = createSignal<AccessControlSettings>(
	DEFAULT_ACCESS_CONTROL_SETTINGS,
);
export const [accessControlSettingsLoaded, setAccessControlSettingsLoaded] = createSignal(false);

// Local settings (persisted to localStorage)
export const [localSettings, setLocalSettings] = createSignal<LocalSettings>({
	offlineVoice: '',
	elevenLabsVoice: 'Rachel',
	voiceGenerator: 'offline',
	speakOnTap: true,
	sentenceBuilder: true,
	// Defaults below match how the app already behaved, so upgrading changes nothing on screen.
	webImageSearch: true,
	tileTextSize: 'medium',
	tileTextOverflow: 'truncate',
	tileImageFit: 'contain',
	skinTone: 'medium',
	lastVisitedProjectId: '',
	lastVisitedPageId: '',
});

// Passcode gate plumbing. The gated action is held here so the modal stays generic: whichever
// button opened the prompt supplies both the wording and what to run once it is satisfied.
export const [pinPromptText, setPinPromptText] = createSignal('');
const [pinUnlockHandler, setPinUnlockHandler] = createSignal<() => void>(() => {});

export function requestPinUnlock(prompt: string, onUnlock: () => void) {
	setPinPromptText(prompt);
	setPinUnlockHandler(() => onUnlock);
}

export function runPinUnlockHandler() {
	pinUnlockHandler()();
	setPinUnlockHandler(() => () => {});
}

// Initialize from localStorage and set up persistence
if (typeof window !== 'undefined') {
	// Enable third-party voice providers
	const enableThirdPartyVoiceProvidersValue = localStorage.getItem('enableThirdPartyVoiceProviders');
	if (enableThirdPartyVoiceProvidersValue) {
		setEnableThirdPartyVoiceProviders(enableThirdPartyVoiceProvidersValue === 'true');
	}

	// ElevenLabs voice ID
	const elevenLabsVoiceIdValue = localStorage.getItem('elevenLabsVoiceId');
	if (elevenLabsVoiceIdValue) {
		setElevenLabsVoiceId(elevenLabsVoiceIdValue);
	}

	// Offline voice URI
	const offlineVoiceUriValue = localStorage.getItem('offlineVoiceUri');
	if (offlineVoiceUriValue) {
		setOfflineVoiceUri(offlineVoiceUriValue);
	}

	// Enable sentence copy button
	const enableSentenceCopyButtonValue = localStorage.getItem('enableSentenceCopyButton');
	if (enableSentenceCopyButtonValue) {
		setEnableSentenceCopyButton(enableSentenceCopyButtonValue === 'true');
	}

	// Local settings
	const localSettingsValue = localStorage.getItem('localSettings');
	if (localSettingsValue) {
		const saved = JSON.parse(localSettingsValue) as Record<string, unknown>;
		// Device-local PINs predate account-backed access controls. Do not let those legacy values
		// reactivate a gate after the account defaults have deliberately reset every PIN to off.
		for (const key of [
			'editPinEnabled',
			'editPinMode',
			'editPinHash',
			'editPinSalt',
			'editPinFailureCount',
			'editPinLockoutUntil',
		]) {
			delete saved[key];
		}
		setLocalSettings({ ...localSettings(), ...saved } as LocalSettings);
	}

	// Set up persistence effects inside createRoot to avoid warnings
	createRoot(() => {
		createEffect(() => {
			localStorage.setItem('enableThirdPartyVoiceProviders', enableThirdPartyVoiceProviders().toString());
		});

		createEffect(() => {
			const value = elevenLabsVoiceId();
			if (value) {
				localStorage.setItem('elevenLabsVoiceId', value);
			} else {
				localStorage.removeItem('elevenLabsVoiceId');
			}
		});

		createEffect(() => {
			const value = offlineVoiceUri();
			if (value) {
				localStorage.setItem('offlineVoiceUri', value);
			} else {
				localStorage.removeItem('offlineVoiceUri');
			}
		});

		createEffect(() => {
			localStorage.setItem('enableSentenceCopyButton', enableSentenceCopyButton().toString());
		});

		createEffect(() => {
			const value = localSettings();
			if (value) {
				localStorage.setItem('localSettings', JSON.stringify(value));
			} else {
				localStorage.removeItem('localSettings');
			}
		});
	});
}
