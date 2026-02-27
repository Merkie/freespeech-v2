import { mutateBlob } from './blob-sync';
import { projectBlob } from './state';
import type { TileBlob } from './types';

// --- Tile operations ---

export function blobCreateTile(
	pageId: string,
	position: { x: number; y: number; page: number },
	data?: Partial<Omit<TileBlob, 'x' | 'y' | 'page'>>,
): TileBlob {
	const tile: TileBlob = {
		x: position.x,
		y: position.y,
		page: position.page,
		text: data?.text ?? 'New tile',
		...(data?.displayText && { displayText: data.displayText }),
		...(data?.backgroundColor && { backgroundColor: data.backgroundColor }),
		...(data?.borderColor && { borderColor: data.borderColor }),
		...(data?.image && { image: data.image }),
		...(data?.navigation && { navigation: data.navigation }),
	};

	mutateBlob((blob) => {
		const page = blob.pages.find((p) => p.id === pageId);
		if (page) {
			page.tiles.push(tile);
		}
	});

	return tile;
}

export function blobUpdateTile(
	pageId: string,
	position: { x: number; y: number; page: number },
	updates: Partial<Omit<TileBlob, 'x' | 'y' | 'page'>>,
): void {
	mutateBlob((blob) => {
		const page = blob.pages.find((p) => p.id === pageId);
		if (!page) return;
		const tile = page.tiles.find((t) => t.x === position.x && t.y === position.y && t.page === position.page);
		if (!tile) return;
		Object.assign(tile, stripEmptyUpdates(updates));
	});
}

export function blobUpdateTilesBatch(
	pageId: string,
	positions: { x: number; y: number; page: number }[],
	updates: Partial<Omit<TileBlob, 'x' | 'y' | 'page'>>,
): void {
	const posSet = new Set(positions.map((p) => `${p.x}-${p.y}-${p.page}`));

	mutateBlob((blob) => {
		const page = blob.pages.find((p) => p.id === pageId);
		if (!page) return;
		const stripped = stripEmptyUpdates(updates);
		for (const tile of page.tiles) {
			if (posSet.has(`${tile.x}-${tile.y}-${tile.page}`)) {
				Object.assign(tile, stripped);
			}
		}
	});
}

export function blobDeleteTiles(pageId: string, positions: { x: number; y: number; page: number }[]): void {
	const posSet = new Set(positions.map((p) => `${p.x}-${p.y}-${p.page}`));

	mutateBlob((blob) => {
		const page = blob.pages.find((p) => p.id === pageId);
		if (!page) return;
		page.tiles = page.tiles.filter((t) => !posSet.has(`${t.x}-${t.y}-${t.page}`));
	});
}

// --- Page operations ---

export function blobCreatePage(name: string): string {
	const newPageId = crypto.randomUUID();

	mutateBlob((blob) => {
		blob.pages.push({
			id: newPageId,
			name,
			tiles: [],
		});
	});

	return newPageId;
}

export function blobRenamePage(pageId: string, newName: string): void {
	mutateBlob((blob) => {
		const page = blob.pages.find((p) => p.id === pageId);
		if (page) {
			page.name = newName;
		}
	});
}

export function blobDeletePage(pageId: string): boolean {
	const blob = projectBlob();
	if (!blob) return false;

	// Don't delete the home page
	if (blob.homePageId === pageId) return false;

	mutateBlob((b) => {
		b.pages = b.pages.filter((p) => p.id !== pageId);
	});
	return true;
}

// --- Project settings ---

export function blobUpdateProject(updates: {
	name?: string;
	columns?: number;
	rows?: number;
	homePageId?: string | null;
}): void {
	mutateBlob((blob) => {
		if (updates.name !== undefined) blob.name = updates.name;
		if (updates.columns !== undefined) blob.columns = updates.columns;
		if (updates.rows !== undefined) blob.rows = updates.rows;
		if (updates.homePageId !== undefined) blob.homePageId = updates.homePageId;
	});
}

// --- Template operations ---

export function blobCreateTemplate(name: string, tiles: TileBlob[]): string {
	const templateId = crypto.randomUUID();

	mutateBlob((blob) => {
		blob.pages.push({
			id: templateId,
			name,
			tiles,
			isTemplate: true,
		});
	});

	return templateId;
}

export function blobRenameTemplate(templateId: string, newName: string): void {
	mutateBlob((blob) => {
		const page = blob.pages.find((p) => p.id === templateId && p.isTemplate);
		if (page) {
			page.name = newName;
		}
	});
}

export function blobDeleteTemplate(templateId: string): void {
	mutateBlob((blob) => {
		// Remove the template page
		blob.pages = blob.pages.filter((p) => p.id !== templateId);
		// Clear templatePageId references on pages that used this template
		for (const page of blob.pages) {
			if (page.templatePageId === templateId) {
				delete page.templatePageId;
			}
		}
	});
}

export function blobLinkTemplate(pageId: string, templatePageId: string): void {
	mutateBlob((blob) => {
		const page = blob.pages.find((p) => p.id === pageId);
		if (page) {
			page.templatePageId = templatePageId;
		}
	});
}

export function blobUnlinkTemplate(pageId: string): void {
	mutateBlob((blob) => {
		const page = blob.pages.find((p) => p.id === pageId);
		if (page) {
			delete page.templatePageId;
		}
	});
}

// --- Helpers ---

// For blob wire format: strip fields that match defaults to keep blob small
function stripEmptyUpdates(updates: Partial<Omit<TileBlob, 'x' | 'y' | 'page'>>): Partial<Omit<TileBlob, 'x' | 'y' | 'page'>> {
	const result: Partial<Omit<TileBlob, 'x' | 'y' | 'page'>> = {};

	if (updates.text !== undefined) result.text = updates.text;

	// For optional fields: set if non-empty, delete (undefined) if empty
	if (updates.displayText !== undefined) {
		result.displayText = updates.displayText || undefined;
	}
	if (updates.backgroundColor !== undefined) {
		result.backgroundColor = updates.backgroundColor === '#fafafa' ? undefined : updates.backgroundColor;
	}
	if (updates.borderColor !== undefined) {
		result.borderColor = updates.borderColor === '#71717a' ? undefined : updates.borderColor;
	}
	if (updates.image !== undefined) {
		result.image = updates.image || undefined;
	}
	if (updates.navigation !== undefined) {
		result.navigation = updates.navigation || undefined;
	}

	return result;
}
