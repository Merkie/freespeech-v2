export type IVoiceGenerator = 'elevenlabs' | 'offline';
export type IElevenLabsVoice = 'Rachel' | 'Domi' | 'Bella' | 'Antoni' | 'Elli' | 'Josh' | 'Arnold' | 'Adam' | 'Sam';

export type SkinTone = 'dark' | 'medium-dark' | 'medium' | 'medium-light' | 'light';

export type TileTextSize = 'small' | 'medium' | 'large' | 'x-large';
export type TileTextOverflow = 'truncate' | 'wrap';
export type TileImageFit = 'contain' | 'cover';

/** 'pin' checks a stored 4-digit hash; 'math' asks a multiplication question and stores nothing. */
export type EditPinMode = 'pin' | 'math';

export type AccessControlSettings = {
	enabled: boolean;
	mode: EditPinMode;
	pinHash: string | null;
	pinSalt: string | null;
	updatedAt: string | null;
};

export type LocalSettings = {
	offlineVoice: string;
	elevenLabsVoice: IElevenLabsVoice;
	voiceGenerator: IVoiceGenerator;
	speakOnTap: boolean;
	sentenceBuilder: boolean;
	webImageSearch: boolean;
	tileTextSize: TileTextSize;
	tileTextOverflow: TileTextOverflow;
	tileImageFit: TileImageFit;
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
	name: string;
	description: string | null;
	imageUrl: string | null;
	columns: number;
	rows: number;
	isPublic: boolean;
	isFavorite: boolean;
	homePageId: string | null;
	lastEditedAt: string | Date;
	createdAt: string | Date;
	updatedAt: string | Date;
};

// Tile is now identified by position (x, y, page) instead of ID
// Tiles are stored as JSON in the blob
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
