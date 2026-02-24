export type IVoiceGenerator = 'elevenlabs' | 'offline';
export type IElevenLabsVoice = 'Rachel' | 'Domi' | 'Bella' | 'Antoni' | 'Elli' | 'Josh' | 'Arnold' | 'Adam' | 'Sam';

export type SkinTone = 'dark' | 'medium-dark' | 'medium' | 'medium-light' | 'light';

export type LocalSettings = {
	offlineVoice: string;
	elevenLabsVoice: IElevenLabsVoice;
	voiceGenerator: IVoiceGenerator;
	speakOnTap: boolean;
	sentenceBuilder: boolean;
	skinTone: SkinTone;
	lastVisitedProjectId: string;
	lastVisitedPageId: string;
};

export type User = {
	id: string;
	email: string;
	name: string;
	password?: string | null;
	profileImgUrl: string | null;
	elevenLabsApiKey: string | null;
	usePersonalElevenLabsKey: boolean;
	createdAt: string | Date;
	updatedAt: string | Date;
};

export type Project = {
	id: string;
	user?: User;
	userId: string;
	connectedPages?: TilePageInProject[];
	name: string;
	description: string | null;
	imageUrl: string | null;
	columns: number;
	rows: number;
	isPublic: boolean;
	homePageId: string | null;
	// For cache invalidation - updated when any tile/page changes
	lastEditedAt: string | Date;
	createdAt: string | Date;
	updatedAt: string | Date;
};

export type TilePage = {
	id: string;
	tiles: Tile[];
	connectedProjects?: TilePageInProject[];
	user?: User;
	userId: string;
	name: string;
	isPublic: boolean;
	isTemplate?: boolean;
	createdAt: string | Date;
	updatedAt: string | Date;
};

export type TilePageInProject = {
	id: string;
	tilePage?: TilePage;
	tilePageId: string;
	project?: Project;
	projectId: string;
	createdAt: string | Date;
	updatedAt: string | Date;
};

// Tile is now identified by position (x, y, page) instead of ID
// Tiles are stored as JSON in TilePage.tiles
export type Tile = {
	x: number;
	y: number;
	page: number;
	text: string;
	displayText: string;
	backgroundColor: string;
	borderColor: string;
	image: string;
	navigation: string;
};

// Position identifier for a tile within a page
export type TilePosition = {
	x: number;
	y: number;
	page: number;
};

// String key for position-based identification: "x-y-page"
export type TilePositionKey = string;

// Template is a TilePage with isTemplate=true
export type Template = TilePage & {
	isTemplate: true;
	columns: number;
	rows: number;
	project?: {
		id: string;
		name: string;
		columns: number;
		rows: number;
	} | null;
	_count?: { linkedPages: number };
};

export type PageTemplateLink = {
	id: string;
	tilePageId: string;
	templatePageId: string;
	templatePage?: TilePage;
	tilePage?: TilePage;
	createdAt: string | Date;
	updatedAt: string | Date;
};

// --- Blob types (for offline-first sync) ---

export type TileBlob = {
	x: number;
	y: number;
	page: number;
	text: string;
	displayText?: string;
	backgroundColor?: string;
	borderColor?: string;
	image?: string;
	navigation?: string;
};

export type PageBlob = {
	id: string;
	name: string;
	tiles: TileBlob[];
	templatePageId?: string;
	templateTiles?: TileBlob[];
};

export type ProjectBlob = {
	id: string;
	name: string;
	description: string | null;
	imageUrl: string | null;
	columns: number;
	rows: number;
	homePageId: string | null;
	lastEditedAt: string;
	pages: PageBlob[];
};

export type CachedProjectBlob = {
	id: string;
	blob: ProjectBlob;
	cachedAt: number;
	dirty: boolean;
};
