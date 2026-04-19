export type OBFImage = {
	id: string;
	url?: string;
	path?: string;
	data?: string;
	content_type?: string;
	width?: number;
	height?: number;
};

export type OBFLoadBoard = {
	id?: string;
	path?: string;
	name?: string;
	url?: string;
};

export type OBFButton = {
	id: string | number;
	label?: string;
	vocalization?: string;
	border_color?: string;
	background_color?: string;
	image_id?: string;
	load_board?: OBFLoadBoard;
	action?: string;
};

export type OBFGrid = {
	rows: number;
	columns: number;
	order: Array<Array<string | number | null>>;
};

export type OBFPage = {
	format?: string;
	id: string;
	locale?: string;
	name: string;
	buttons: OBFButton[];
	grid: OBFGrid;
	images: OBFImage[];
};

export type OBZManifest = {
	root: string;
	paths?: {
		boards?: Record<string, string>;
		images?: Record<string, string>;
	};
};
