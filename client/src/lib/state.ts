import { createEffect, createRoot, createSignal } from 'solid-js';
import type { ModalIdType } from './constants';
import type {
	LocalSettings,
	Project,
	Template,
	Tile,
	TilePage,
	TilePageInProject,
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
export const [currentPage, setCurrentPage] = createSignal<TilePageInProject>(null as unknown as TilePageInProject);
export const [currentPageId, setCurrentPageId] = createSignal('');

// Template state - current page's linked template
export const [currentPageTemplate, setCurrentPageTemplate] = createSignal<Template | null>(null);
export const [currentPageTemplateTiles, setCurrentPageTemplateTiles] = createSignal<Tile[]>([]);

// Template editing mode
export const [editingTemplate, setEditingTemplate] = createSignal<Template | null>(null);

// Track page ID before entering template edit mode (to return to after exiting)
export const [pageIdBeforeTemplateEdit, setPageIdBeforeTemplateEdit] = createSignal<string | null>(null);

// --- this is stuff claude code mostly generated ---

// User state
export const [user, setUser] = createSignal<User | null>(null);

// Speech synthesis
export const [isSynthesizingSpeech, setIsSynthesizingSpeech] = createSignal(false);
export const [sentence, setSentence] = createSignal<Tile[]>([]);
export const [loading, setLoading] = createSignal(false);

// Modals & Panels
export const [unsavedChanges, setUnsavedChanges] = createSignal(false);
export const [discardUnsavedChangesHandler, setDiscardUnsavedChangesHandler] = createSignal<() => void>(() => {});
export const [unsavedChangesModalOpen, setUnsavedChangesModalOpen] = createSignal(false);

export const [editingTiles, setEditingTiles] = createSignal(false);
export const [usingOnlineSearch, setUsingOnlineSearch] = createSignal(false);

// Tile editing - array of tile position keys being edited (supports single and multi-select)
// Position keys are in format "x-y-page" (e.g., "0-1-0")
export const [editingTilePositions, setEditingTilePositions] = createSignal<TilePositionKey[]>([]);

// Pending edits to apply to tiles (for live preview and saving)
export const [pendingTileEdits, setPendingTileEdits] = createSignal<Partial<Tile>>({});

// Helper to check if we're editing multiple tiles
export const isBulkEditing = () => editingTilePositions().length > 1;

// Legacy aliases for backwards compatibility during migration
export const editingTileIds = editingTilePositions;
export const setEditingTileIds = setEditingTilePositions;

// Multi-select mode (for mobile - acts like holding shift)
export const [multiSelectMode, setMultiSelectMode] = createSignal(false);

export const [editingPages, setEditingPages] = createSignal(false);
export const [addingPage, setAddingPage] = createSignal(false);
export const [pageBeingEdited, setPageBeingEdited] = createSignal<TilePage | null>(null);

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

// Project pages (for page management)
export const [projectPages, setProjectPages] = createSignal<TilePage[]>([]);
export const [projectPagesLoading, setProjectPagesLoading] = createSignal(false);

// Loading states for project/page transitions
export const [projectLoading, setProjectLoading] = createSignal(false);
export const [pageLoading, setPageLoading] = createSignal(false);

// Reset all project-related state when switching projects
export function resetProjectState() {
	setSentence([]);
	setEditingTiles(false);
	setEditingTilePositions([]);
	setPendingTileEdits({});
	setMultiSelectMode(false);
	setUsingOnlineSearch(false);
	setEditingPages(false);
	setAddingPage(false);
	setPageBeingEdited(null);
	setProjectPages([]);
	setCurrentPage(null as unknown as TilePageInProject);
	setCurrentPageId('');
	setCurrentPageTemplate(null);
	setCurrentPageTemplateTiles([]);
	setEditingTemplate(null);
	setPageIdBeforeTemplateEdit(null);
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

// Local settings (persisted to localStorage)
export const [localSettings, setLocalSettings] = createSignal<LocalSettings>({
	offlineVoice: '',
	elevenLabsVoice: 'Rachel',
	voiceGenerator: 'offline',
	speakOnTap: true,
	sentenceBuilder: true,
	skinTone: 'medium',
	lastVisitedProjectId: '',
	lastVisitedPageId: '',
});

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
		setLocalSettings({ ...localSettings(), ...JSON.parse(localSettingsValue) });
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
