/**
 * Migration: fold the normalised TilePage / Tile / TilePageInProject tables into each project's
 * single `blob` JSON column.
 *
 * Run this against a database that still has the OLD tables but has already had the new columns
 * added. Add them with explicit DDL, NOT with `prisma db push` — the v2 schema no longer declares
 * the old tables, so a push wants to drop them, which would destroy the data this script is here
 * to read:
 *
 *   ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "blob" JSONB NOT NULL
 *     DEFAULT '{"name":"","description":null,"imageUrl":null,"columns":6,"rows":4,"homePageId":null,"pages":[]}';
 *   ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "lastEditedAt" TIMESTAMP NOT NULL DEFAULT now();
 *   ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "isFavorite" BOOLEAN NOT NULL DEFAULT false;
 *
 * Only drop the old tables after this script's output has been reviewed and the app verified.
 *
 *   bun src/scripts/migrate-to-blob.ts --dry-run          # report only, writes nothing
 *   bun src/scripts/migrate-to-blob.ts --dry-run --limit 50
 *   bun src/scripts/migrate-to-blob.ts                    # writes
 *
 * Reads use raw SQL because the old models are no longer in the Prisma schema.
 *
 * Notes on the real production shape, measured rather than assumed:
 *  - `TilePage` has no `tiles` column; tiles live in a separate `Tile` table keyed by
 *    `tilePageId`. An earlier version of this script joined `tp.tiles` and would have migrated
 *    every project as empty.
 *  - `TilePageInProject` is a many-to-many that is never used as one: no page belongs to more
 *    than one project. That is what makes a per-project blob lossless.
 *  - A small number of pages belong to no project at all, and a small number of tiles navigate
 *    to a page outside their own project. Both are counted and reported below.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = (() => {
	const i = process.argv.indexOf('--limit');
	return i >= 0 ? Number.parseInt(process.argv[i + 1], 10) : 0;
})();

// Projects are processed in chunks so a database with a million-plus tiles never has to be held
// in memory all at once.
const CHUNK_SIZE = 200;

const DEFAULT_BG = '#fafafa';
const DEFAULT_BORDER = '#71717a';

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
};

type RawProject = {
	id: string;
	name: string;
	description: string | null;
	imageUrl: string | null;
	columns: number;
	rows: number;
	homePageId: string | null;
	updatedAt: Date;
};

type RawPage = { id: string; name: string; projectId: string };

type RawTile = {
	tilePageId: string;
	x: number;
	y: number;
	page: number;
	text: string | null;
	displayText: string | null;
	backgroundColor: string | null;
	borderColor: string | null;
	image: string | null;
	navigation: string | null;
};

/** Drops values equal to the rendering defaults; a tile is mostly defaults, so this matters. */
function stripTileDefaults(tile: RawTile): TileBlob {
	const stripped: TileBlob = {
		x: tile.x,
		y: tile.y,
		page: tile.page,
		text: tile.text ?? '',
	};

	if (tile.displayText) stripped.displayText = tile.displayText;
	if (tile.backgroundColor && tile.backgroundColor !== DEFAULT_BG) {
		stripped.backgroundColor = tile.backgroundColor;
	}
	if (tile.borderColor && tile.borderColor !== DEFAULT_BORDER) {
		stripped.borderColor = tile.borderColor;
	}
	if (tile.image) stripped.image = tile.image;
	if (tile.navigation) stripped.navigation = tile.navigation;

	return stripped;
}

function chunk<T>(items: T[], size: number): T[][] {
	const out: T[][] = [];
	for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
	return out;
}

async function main() {
	console.log(`Blob migration — ${DRY_RUN ? 'DRY RUN, nothing will be written' : 'WRITING'}\n`);

	const projects = await prisma.$queryRaw<RawProject[]>`
		SELECT id, name, description, "imageUrl", columns, rows, "homePageId", "updatedAt"
		FROM "Project"
		ORDER BY id
	`;

	const selected = LIMIT > 0 ? projects.slice(0, LIMIT) : projects;
	console.log(`${projects.length} project(s) in the database, migrating ${selected.length}.\n`);

	const stats = {
		migrated: 0,
		failed: 0,
		pages: 0,
		tiles: 0,
		emptyProjects: 0,
		danglingNav: 0,
		homeFromField: 0,
		homeByName: 0,
		homeFirstPage: 0,
		homeNone: 0,
		largestBlobBytes: 0,
		largestBlobProject: '',
		totalBlobBytes: 0,
	};

	for (const group of chunk(selected, CHUNK_SIZE)) {
		const projectIds = group.map((p) => p.id);

		// Two queries per chunk instead of two per project.
		const pages = await prisma.$queryRaw<RawPage[]>`
			SELECT tp.id, tp.name, tpip."projectId"
			FROM "TilePage" tp
			JOIN "TilePageInProject" tpip ON tpip."tilePageId" = tp.id
			WHERE tpip."projectId" = ANY(${projectIds})
			ORDER BY tp."createdAt", tp.id
		`;

		const pageIds = pages.map((p) => p.id);
		const tiles = pageIds.length
			? await prisma.$queryRaw<RawTile[]>`
					SELECT t."tilePageId", t.x, t.y, t.page, t.text, t."displayText",
					       t."backgroundColor", t."borderColor", t.image, t.navigation
					FROM "Tile" t
					WHERE t."tilePageId" = ANY(${pageIds})
					ORDER BY t."tilePageId", t.page, t.y, t.x
				`
			: [];

		const pagesByProject = new Map<string, RawPage[]>();
		for (const page of pages) {
			const list = pagesByProject.get(page.projectId);
			if (list) list.push(page);
			else pagesByProject.set(page.projectId, [page]);
		}

		const tilesByPage = new Map<string, RawTile[]>();
		for (const tile of tiles) {
			const list = tilesByPage.get(tile.tilePageId);
			if (list) list.push(tile);
			else tilesByPage.set(tile.tilePageId, [tile]);
		}

		for (const project of group) {
			try {
				const projectPages = pagesByProject.get(project.id) ?? [];
				const pageIdSet = new Set(projectPages.map((p) => p.id));

				const blobPages: PageBlob[] = projectPages.map((page) => ({
					id: page.id,
					name: page.name,
					tiles: (tilesByPage.get(page.id) ?? []).map((tile) => {
						const blobTile = stripTileDefaults(tile);
						// A blob is meant to be self-contained, so a navigation target that is not one
						// of this project's own pages cannot survive the move. Those tiles already do
						// nothing when tapped; dropping the pointer at least lets them speak their label.
						if (blobTile.navigation && !pageIdSet.has(blobTile.navigation)) {
							stats.danglingNav++;
							blobTile.navigation = undefined;
						}
						return blobTile;
					}),
				}));

				const homePageId = resolveHomePageId(project, blobPages, pageIdSet, stats);

				const blob = {
					name: project.name,
					description: project.description ?? '',
					imageUrl: project.imageUrl,
					columns: project.columns,
					rows: project.rows,
					homePageId,
					pages: blobPages,
				};

				const bytes = Buffer.byteLength(JSON.stringify(blob));
				stats.totalBlobBytes += bytes;
				if (bytes > stats.largestBlobBytes) {
					stats.largestBlobBytes = bytes;
					stats.largestBlobProject = `${project.name} (${project.id})`;
				}

				stats.pages += blobPages.length;
				stats.tiles += blobPages.reduce((n, p) => n + p.tiles.length, 0);
				if (blobPages.length === 0) stats.emptyProjects++;

				if (!DRY_RUN) {
					// Written as raw SQL rather than prisma.project.update because the model marks
					// updatedAt with @updatedAt: Prisma would stamp it with the migration time, and
					// since the dashboard sorts by updatedAt by default that would flatten everyone's
					// "recently used" ordering into a single timestamp. Migrating storage should not
					// look like the user edited every board at once.
					await prisma.$executeRaw`
						UPDATE "Project"
						SET blob = ${JSON.stringify(blob)}::jsonb,
						    "homePageId" = ${homePageId},
						    -- The old schema has no lastEditedAt; updatedAt is the closest true value and
						    -- stops the sync's conflict check treating every project as freshly edited.
						    "lastEditedAt" = ${project.updatedAt},
						    "updatedAt" = ${project.updatedAt}
						WHERE id = ${project.id}
					`;
				}

				stats.migrated++;
			} catch (error) {
				stats.failed++;
				console.error(`  [FAIL] ${project.name} (${project.id}):`, error);
			}
		}

		console.log(`  ${stats.migrated}/${selected.length} projects processed`);
	}

	// Anything the blob model has nowhere to put is reported rather than silently dropped.
	const [{ orphanPages }] = await prisma.$queryRaw<[{ orphanPages: bigint }]>`
		SELECT count(*) AS "orphanPages"
		FROM "TilePage" tp
		WHERE NOT EXISTS (SELECT 1 FROM "TilePageInProject" l WHERE l."tilePageId" = tp.id)
	`;
	const [{ sharedPages }] = await prisma.$queryRaw<[{ sharedPages: bigint }]>`
		SELECT count(*) AS "sharedPages"
		FROM (SELECT "tilePageId" FROM "TilePageInProject" GROUP BY 1 HAVING count(*) > 1) x
	`;

	console.log(`\n${'-'.repeat(60)}`);
	console.log(`Migrated:              ${stats.migrated}`);
	console.log(`Failed:                ${stats.failed}`);
	console.log(`Pages written:         ${stats.pages}`);
	console.log(`Tiles written:         ${stats.tiles}`);
	console.log(`Projects with 0 pages: ${stats.emptyProjects}`);
	console.log(`\nHome page resolved from:`);
	console.log(`  existing homePageId: ${stats.homeFromField}`);
	console.log(`  page named "home":   ${stats.homeByName}`);
	console.log(`  first page:          ${stats.homeFirstPage}`);
	console.log(`  none (no pages):     ${stats.homeNone}`);
	console.log(`\nBlob sizes:`);
	console.log(`  total:               ${(stats.totalBlobBytes / 1024 / 1024).toFixed(1)} MB`);
	console.log(`  average:             ${stats.migrated ? Math.round(stats.totalBlobBytes / stats.migrated) : 0} bytes`);
	console.log(`  largest:             ${(stats.largestBlobBytes / 1024).toFixed(1)} KB — ${stats.largestBlobProject}`);
	console.log(`\nData that does not fit the blob model:`);
	console.log(`  dangling navigation targets dropped: ${stats.danglingNav}`);
	console.log(`  pages belonging to no project:       ${orphanPages} (left in place, not migrated)`);
	console.log(`  pages shared by >1 project:          ${sharedPages} (must be 0 for this to be lossless)`);
	console.log(`${'-'.repeat(60)}`);

	if (sharedPages > 0n) {
		console.log(`\nSTOP: pages are shared between projects. A per-project blob would duplicate them.`);
	}

	if (DRY_RUN) {
		console.log(`\nDry run — nothing was written. Re-run without --dry-run to apply.`);
	} else {
		console.log(`\nNext steps:`);
		console.log(`  1. Verify the app reads the migrated projects correctly`);
		console.log(`  2. Only then drop "TilePage", "Tile", "TilePageInProject", "PageTemplateLink"`);
	}

	await prisma.$disconnect();
}

/**
 * The stored homePageId is trusted when it really is one of this project's pages; otherwise the
 * page called "Home" wins, then simply the first page. Every project that has any pages ends up
 * with a home page, because the app has nowhere to land without one.
 */
function resolveHomePageId(
	project: RawProject,
	blobPages: PageBlob[],
	pageIdSet: Set<string>,
	stats: { homeFromField: number; homeByName: number; homeFirstPage: number; homeNone: number },
): string | null {
	if (project.homePageId && pageIdSet.has(project.homePageId)) {
		stats.homeFromField++;
		return project.homePageId;
	}

	const named = blobPages.find((p) => p.name.toLowerCase().trim() === 'home');
	if (named) {
		stats.homeByName++;
		return named.id;
	}

	if (blobPages.length > 0) {
		stats.homeFirstPage++;
		return blobPages[0].id;
	}

	stats.homeNone++;
	return null;
}

main().catch((error) => {
	console.error('Migration failed:', error);
	process.exit(1);
});
