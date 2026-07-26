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

// --- Sync data helper (columns synced from blob for fast listing queries) ---

export function getRecordSyncData(blob: ProjectBlob) {
	return {
		name: blob.name,
		description: blob.description,
		imageUrl: blob.imageUrl,
		columns: blob.columns,
		rows: blob.rows,
		homePageId: blob.homePageId,
	};
}

// --- Build blob from database ---

export async function buildProjectBlob(projectId: string, userId: string): Promise<ProjectBlob | null> {
	const project = await prisma.project.findFirst({
		where: { id: projectId, userId },
		select: { id: true, blob: true, lastEditedAt: true },
	});

	if (!project) return null;

	const raw = project.blob as Record<string, unknown>;
	raw.id = project.id;
	raw.lastEditedAt = project.lastEditedAt.toISOString();

	return ProjectBlobSchema.parse(raw);
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

// Unknown keys are stripped by default, so blobs still carrying the removed
// template fields (isTemplate / templatePageId) validate and drop them.
const PageBlobSchema = z.object({
	id: z.string(),
	name: z.string(),
	tiles: z.array(TileBlobSchema),
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

// --- Apply blob to database ---

export async function applyProjectBlob(
	projectId: string,
	userId: string,
	blob: z.infer<typeof ProjectBlobSchema>,
	expectedLastEditedAt: string,
	force = false,
): Promise<{ success: boolean; conflict?: boolean; serverBlob?: ProjectBlob; newLastEditedAt?: string }> {
	const project = await prisma.project.findFirst({
		where: { id: projectId, userId },
		select: { id: true, lastEditedAt: true },
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

	// Store full blob (minus transient id/lastEditedAt) and sync columns
	const blobData = {
		name: blob.name,
		description: blob.description,
		imageUrl: blob.imageUrl,
		columns: blob.columns,
		rows: blob.rows,
		homePageId: blob.homePageId,
		pages: blob.pages,
	};

	await prisma.project.update({
		where: { id: projectId },
		data: {
			...getRecordSyncData(blob),
			blob: blobData,
			lastEditedAt: now,
		},
	});

	return { success: true, newLastEditedAt: now.toISOString() };
}
