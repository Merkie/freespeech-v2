/**
 * Migration script: Populate project.blob column from TilePage/TilePageInProject/PageTemplateLink tables.
 *
 * Run this BEFORE deploying the new code and BEFORE dropping old tables.
 * Uses raw SQL since the old Prisma models have been removed from the schema.
 *
 * Usage:
 *   npx tsx src/scripts/migrate-to-blob.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type TileBlob = {
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

type PageBlob = {
	id: string;
	name: string;
	tiles: TileBlob[];
	isTemplate?: boolean;
	templatePageId?: string;
};

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

type RawPage = {
	id: string;
	name: string;
	tiles: unknown;
	isTemplate: boolean;
};

type RawTemplateLink = {
	tilePageId: string;
	templatePageId: string;
};

async function main() {
	console.log('Starting blob migration...\n');

	// Get all projects
	const projects = await prisma.project.findMany({
		select: { id: true, name: true },
	});

	console.log(`Found ${projects.length} projects to migrate.\n`);

	let migrated = 0;
	let failed = 0;

	for (const project of projects) {
		try {
			// Get all pages connected to this project via raw SQL
			const pages = await prisma.$queryRaw<RawPage[]>`
				SELECT tp.id, tp.name, tp.tiles, tp."isTemplate"
				FROM "TilePage" tp
				JOIN "TilePageInProject" tpip ON tpip."tilePageId" = tp.id
				WHERE tpip."projectId" = ${project.id}
			`;

			// Get template links for pages in this project
			const templateLinks = await prisma.$queryRaw<RawTemplateLink[]>`
				SELECT ptl."tilePageId", ptl."templatePageId"
				FROM "PageTemplateLink" ptl
				JOIN "TilePageInProject" tpip ON tpip."tilePageId" = ptl."tilePageId"
				WHERE tpip."projectId" = ${project.id}
			`;

			// Build a lookup for template links
			const templateLinkMap = new Map<string, string>();
			for (const link of templateLinks) {
				templateLinkMap.set(link.tilePageId, link.templatePageId);
			}

			// Build pages array for blob
			const blobPages: PageBlob[] = pages.map((tp) => {
				const rawTiles = (tp.tiles as Record<string, unknown>[]) || [];
				const tiles = rawTiles.map(stripTileDefaults);

				const pageBlob: PageBlob = {
					id: tp.id,
					name: tp.name,
					tiles,
				};

				if (tp.isTemplate) {
					pageBlob.isTemplate = true;
				}

				const linkedTemplateId = templateLinkMap.get(tp.id);
				if (linkedTemplateId) {
					pageBlob.templatePageId = linkedTemplateId;
				}

				return pageBlob;
			});

			// Write blob to project
			await prisma.project.update({
				where: { id: project.id },
				data: {
					blob: { pages: blobPages },
				},
			});

			migrated++;
			console.log(`  [OK] ${project.name} (${project.id}) — ${blobPages.length} pages`);
		} catch (error) {
			failed++;
			console.error(`  [FAIL] ${project.name} (${project.id}):`, error);
		}
	}

	console.log(`\nMigration complete:`);
	console.log(`  Migrated: ${migrated}`);
	console.log(`  Failed:   ${failed}`);
	console.log(`\nNext steps:`);
	console.log(`  1. Deploy new code that reads from project.blob`);
	console.log(`  2. Verify everything works`);
	console.log(`  3. Run Prisma migration to drop TilePage, TilePageInProject, PageTemplateLink tables`);

	await prisma.$disconnect();
}

main().catch((error) => {
	console.error('Migration failed:', error);
	process.exit(1);
});
