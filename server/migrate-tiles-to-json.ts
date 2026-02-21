/**
 * Migration: Move tiles from separate Tile table into TilePage.tiles JSON column
 *
 * Steps:
 * 1. Add `tiles` JSON column to TilePage (default '[]')
 * 2. Add `lastEditedAt` column to Project (default now())
 * 3. Migrate tile rows into JSON arrays grouped by tilePageId
 * 4. Drop the old Tile table
 *
 * Safe to re-run — skips steps that are already done.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrate() {
	// Step 1: Add tiles JSON column to TilePage if it doesn't exist
	const tpCols = await prisma.$queryRaw<{ column_name: string }[]>`
		SELECT column_name FROM information_schema.columns
		WHERE table_name = 'TilePage' AND column_name = 'tiles'
	`;

	if (tpCols.length === 0) {
		console.log('Adding tiles column to TilePage...');
		await prisma.$executeRawUnsafe(`ALTER TABLE "TilePage" ADD COLUMN "tiles" JSONB NOT NULL DEFAULT '[]'`);
		console.log('Done.');
	} else {
		console.log('TilePage.tiles column already exists, skipping.');
	}

	// Step 2: Add lastEditedAt column to Project if it doesn't exist
	const projCols = await prisma.$queryRaw<{ column_name: string }[]>`
		SELECT column_name FROM information_schema.columns
		WHERE table_name = 'Project' AND column_name = 'lastEditedAt'
	`;

	if (projCols.length === 0) {
		console.log('Adding lastEditedAt column to Project...');
		await prisma.$executeRawUnsafe(
			`ALTER TABLE "Project" ADD COLUMN "lastEditedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`
		);
		console.log('Done.');
	} else {
		console.log('Project.lastEditedAt column already exists, skipping.');
	}

	// Step 3: Migrate tiles from Tile table into TilePage.tiles JSON
	const tileTableExists = await prisma.$queryRaw<{ exists: boolean }[]>`
		SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Tile')
	`;

	if (!tileTableExists[0]?.exists) {
		console.log('Tile table does not exist, migration already complete.');
		await prisma.$disconnect();
		return;
	}

	const tileCount = await prisma.$queryRaw<{ cnt: bigint }[]>`SELECT count(*) as cnt FROM "Tile"`;
	console.log(`\nMigrating ${tileCount[0].cnt} tiles from Tile table...`);

	// Get all distinct tilePageIds that have tiles
	const pageIds = await prisma.$queryRaw<{ tilePageId: string }[]>`
		SELECT DISTINCT "tilePageId" FROM "Tile"
	`;
	console.log(`Found ${pageIds.length} pages with tiles.`);

	// Process in batches of 500 pages
	const BATCH_SIZE = 500;
	let processed = 0;

	for (let i = 0; i < pageIds.length; i += BATCH_SIZE) {
		const batch = pageIds.slice(i, i + BATCH_SIZE);
		const ids = batch.map((p) => p.tilePageId);

		// Use a single UPDATE ... FROM subquery to batch-update all pages in this batch
		await prisma.$executeRawUnsafe(
			`
			UPDATE "TilePage" tp
			SET "tiles" = sub.tiles_json
			FROM (
				SELECT "tilePageId",
					jsonb_agg(
						jsonb_build_object(
							'id', t."id",
							'x', t."x",
							'y', t."y",
							'page', t."page",
							'text', t."text",
							'displayText', t."displayText",
							'backgroundColor', t."backgroundColor",
							'borderColor', t."borderColor",
							'image', t."image",
							'navigation', t."navigation"
						)
					) as tiles_json
				FROM "Tile" t
				WHERE t."tilePageId" = ANY($1::text[])
				GROUP BY t."tilePageId"
			) sub
			WHERE tp."id" = sub."tilePageId"
			`,
			ids
		);

		processed += batch.length;
		if (processed % 5000 === 0 || processed === pageIds.length) {
			console.log(`  Processed ${processed}/${pageIds.length} pages`);
		}
	}

	// Step 4: Verify migration before dropping
	const emptyCheck = await prisma.$queryRaw<{ cnt: bigint }[]>`
		SELECT count(*) as cnt FROM "TilePage"
		WHERE "id" IN (SELECT DISTINCT "tilePageId" FROM "Tile")
		AND "tiles" = '[]'::jsonb
	`;

	if (emptyCheck[0].cnt > 0n) {
		console.error(`\nERROR: ${emptyCheck[0].cnt} pages still have empty tiles after migration. Aborting drop.`);
		await prisma.$disconnect();
		process.exit(1);
	}

	console.log('\nVerification passed — all pages have tiles populated.');
	console.log('Dropping old Tile table...');
	await prisma.$executeRawUnsafe(`DROP TABLE "Tile"`);
	console.log('Done!');

	// Step 5: Now safe to run prisma db push for any remaining schema changes
	console.log('\nMigration complete. Run `bunx prisma db push` to sync any remaining schema differences.');

	await prisma.$disconnect();
}

migrate().catch((e) => {
	console.error('Migration failed:', e);
	prisma.$disconnect();
	process.exit(1);
});
