import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '@/resources/prisma';

// --- Types ---

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

// --- Defaults (for stripping) ---

const DEFAULT_BG = '#fafafa';
const DEFAULT_BORDER = '#71717a';

function stripTileDefaults(tile: Record<string, unknown>): TileBlob {
	const stripped: TileBlob = {
		x: tile.x as number,
		y: tile.y as number,
		page: tile.page as number,
		text: tile.text as string,
	};

	const displayText = tile.displayText as string | undefined;
	if (displayText && displayText !== '') {
		stripped.displayText = displayText;
	}

	const backgroundColor = tile.backgroundColor as string | undefined;
	if (backgroundColor && backgroundColor !== '' && backgroundColor !== DEFAULT_BG) {
		stripped.backgroundColor = backgroundColor;
	}

	const borderColor = tile.borderColor as string | undefined;
	if (borderColor && borderColor !== '' && borderColor !== DEFAULT_BORDER) {
		stripped.borderColor = borderColor;
	}

	const image = tile.image as string | undefined;
	if (image && image !== '') {
		stripped.image = image;
	}

	const navigation = tile.navigation as string | undefined;
	if (navigation && navigation !== '') {
		stripped.navigation = navigation;
	}

	return stripped;
}

// --- Build blob from database ---

export async function buildProjectBlob(projectId: string, userId: string): Promise<ProjectBlob | null> {
	const project = await prisma.project.findFirst({
		where: { id: projectId, userId },
		include: {
			connectedPages: {
				include: {
					tilePage: {
						include: {
							templateLink: {
								include: {
									templatePage: true,
								},
							},
						},
					},
				},
			},
		},
	});

	if (!project) return null;

	const pages: PageBlob[] = project.connectedPages.map((cp) => {
		const tp = cp.tilePage;
		const rawTiles = (tp.tiles as Record<string, unknown>[]) || [];
		const tiles = rawTiles.map(stripTileDefaults);

		const pageBlob: PageBlob = {
			id: tp.id,
			name: tp.name,
			tiles,
		};

		// Include template info if linked
		if (tp.templateLink) {
			pageBlob.templatePageId = tp.templateLink.templatePageId;
			const templateRawTiles = (tp.templateLink.templatePage.tiles as Record<string, unknown>[]) || [];
			pageBlob.templateTiles = templateRawTiles.map(stripTileDefaults);
		}

		return pageBlob;
	});

	return {
		id: project.id,
		name: project.name,
		description: project.description,
		imageUrl: project.imageUrl,
		columns: project.columns,
		rows: project.rows,
		homePageId: project.homePageId,
		lastEditedAt: project.lastEditedAt.toISOString(),
		pages,
	};
}

// --- Zod schema for incoming blobs ---

const TileBlobSchema = z.object({
	x: z.number().int().min(0),
	y: z.number().int().min(0),
	page: z.number().int().min(0),
	text: z.string(),
	displayText: z.string().optional(),
	backgroundColor: z.string().optional(),
	borderColor: z.string().optional(),
	image: z.string().optional(),
	navigation: z.string().optional(),
});

const PageBlobSchema = z.object({
	id: z.string(),
	name: z.string(),
	tiles: z.array(TileBlobSchema),
	templatePageId: z.string().optional(),
	// templateTiles is read-only, not accepted in sync
});

export const ProjectBlobSchema = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string().nullable(),
	imageUrl: z.string().nullable(),
	columns: z.number().int().min(1).max(20),
	rows: z.number().int().min(1).max(20),
	homePageId: z.string().nullable(),
	lastEditedAt: z.string(),
	pages: z.array(PageBlobSchema),
});

// --- Expand stripped tiles back to full format for DB storage ---

function expandTileForDb(tile: TileBlob): Prisma.InputJsonObject {
	return {
		x: tile.x,
		y: tile.y,
		page: tile.page,
		text: tile.text,
		displayText: tile.displayText ?? '',
		backgroundColor: tile.backgroundColor ?? DEFAULT_BG,
		borderColor: tile.borderColor ?? DEFAULT_BORDER,
		image: tile.image ?? '',
		navigation: tile.navigation ?? '',
	};
}

// --- Apply blob to database ---

export async function applyProjectBlob(
	projectId: string,
	userId: string,
	blob: z.infer<typeof ProjectBlobSchema>,
	expectedLastEditedAt: string,
	force = false,
): Promise<{ success: boolean; conflict?: boolean; serverBlob?: ProjectBlob; newLastEditedAt?: string }> {
	// Check ownership and conflict
	const project = await prisma.project.findFirst({
		where: { id: projectId, userId },
		select: {
			id: true,
			lastEditedAt: true,
			connectedPages: {
				select: {
					id: true,
					tilePageId: true,
				},
			},
		},
	});

	if (!project) {
		return { success: false };
	}

	// Conflict check
	if (!force && project.lastEditedAt.toISOString() > expectedLastEditedAt) {
		const serverBlob = await buildProjectBlob(projectId, userId);
		return { success: false, conflict: true, serverBlob: serverBlob ?? undefined };
	}

	const now = new Date();
	const existingPageIds = new Set(project.connectedPages.map((cp) => cp.tilePageId));
	const blobPageIds = new Set(blob.pages.map((p) => p.id));

	// Pages to create, update, delete
	const pagesToCreate = blob.pages.filter((p) => !existingPageIds.has(p.id));
	const pagesToUpdate = blob.pages.filter((p) => existingPageIds.has(p.id));
	const pageIdsToDelete = [...existingPageIds].filter((id) => !blobPageIds.has(id));

	await prisma.$transaction(async (tx) => {
		// Update project settings
		await tx.project.update({
			where: { id: projectId },
			data: {
				name: blob.name,
				description: blob.description,
				imageUrl: blob.imageUrl,
				columns: blob.columns,
				rows: blob.rows,
				homePageId: blob.homePageId,
				lastEditedAt: now,
			},
		});

		// Create new pages
		for (const page of pagesToCreate) {
			await tx.tilePage.create({
				data: {
					id: page.id,
					userId,
					name: page.name,
					tiles: page.tiles.map(expandTileForDb) as unknown as Prisma.InputJsonValue,
				},
			});
			await tx.tilePageInProject.create({
				data: {
					tilePageId: page.id,
					projectId,
				},
			});
		}

		// Update existing pages
		for (const page of pagesToUpdate) {
			await tx.tilePage.update({
				where: { id: page.id },
				data: {
					name: page.name,
					tiles: page.tiles.map(expandTileForDb) as unknown as Prisma.InputJsonValue,
				},
			});
		}

		// Delete removed pages (and their junction records via cascade)
		if (pageIdsToDelete.length > 0) {
			// Delete junction records first
			await tx.tilePageInProject.deleteMany({
				where: {
					projectId,
					tilePageId: { in: pageIdsToDelete },
				},
			});
			// Delete the actual pages
			await tx.tilePage.deleteMany({
				where: {
					id: { in: pageIdsToDelete },
					userId, // Safety check
				},
			});
		}
	});

	return { success: true, newLastEditedAt: now.toISOString() };
}
