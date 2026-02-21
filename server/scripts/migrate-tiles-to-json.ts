/**
 * Migration Script: Tiles Table to JSON
 *
 * This script migrates tile data from the separate Tile table into JSON arrays
 * embedded in TilePage records. This enables:
 * - Instant page loading (1 query instead of N+1)
 * - Position-based tile identification (no more CUIDs)
 * - Better caching for offline-first PWA
 *
 * Run with: npx tsx scripts/migrate-tiles-to-json.ts
 *
 * Steps:
 * 1. Read all TilePages with their tiles
 * 2. Convert tiles to JSON array format
 * 3. Update TilePage.tiles JSON column
 * 4. Verify migration
 *
 * NOTE: After running this migration and verifying it works:
 * 1. Update routes to use JSON tiles
 * 2. Drop the Tile table with a Prisma migration
 */

import { PrismaClient } from '@prisma/client';

// Use a raw client to work with both old and new schema during migration
const prisma = new PrismaClient();

interface OldTile {
	id: string;
	tilePageId: string;
	x: number;
	y: number;
	page: number;
	text: string;
	backgroundColor: string;
	borderColor: string;
	image: string;
	navigation: string;
	displayText: string;
	createdAt: Date;
	updatedAt: Date;
}

interface TileData {
	x: number;
	y: number;
	page: number;
	text: string;
	displayText: string;
	backgroundColor: string;
	borderColor: string;
	image: string;
	navigation: string;
}

async function migrateTilesToJson() {
	console.log('Starting tiles to JSON migration...\n');

	// Check if Tile table exists
	let tileTableExists = false;
	try {
		const result = await prisma.$queryRaw<{ exists: boolean }[]>`
			SELECT EXISTS (
				SELECT FROM information_schema.tables
				WHERE table_schema = 'public'
				AND table_name = 'Tile'
			);
		`;
		tileTableExists = result[0]?.exists ?? false;
	} catch (_error) {
		console.log('Could not check if Tile table exists, assuming it does not');
		tileTableExists = false;
	}

	if (!tileTableExists) {
		console.log('Tile table does not exist. Migration may have already been completed.');
		console.log('Checking if TilePages have JSON tiles...');

		// Verify TilePages have tiles as JSON
		const samplePage = await prisma.tilePage.findFirst({
			select: { id: true, tiles: true },
		});

		if (samplePage) {
			const tiles = samplePage.tiles as unknown;
			if (Array.isArray(tiles)) {
				console.log('TilePages already have JSON tiles. Migration is complete.');
				return;
			}
		}

		console.log('No Tile table and no JSON tiles found. Please check database state.');
		return;
	}

	// Get all tile pages
	const tilePages = await prisma.tilePage.findMany({
		select: { id: true, name: true },
	});

	console.log(`Found ${tilePages.length} tile pages to migrate\n`);

	let successCount = 0;
	let errorCount = 0;
	let totalTiles = 0;

	for (const tilePage of tilePages) {
		try {
			// Fetch tiles for this page using raw query (since model may not exist)
			const tiles = await prisma.$queryRaw<OldTile[]>`
				SELECT * FROM "Tile" WHERE "tilePageId" = ${tilePage.id}
			`;

			// Convert to JSON format (strip id, tilePageId, timestamps)
			const tilesJson: TileData[] = tiles.map((tile) => ({
				x: tile.x,
				y: tile.y,
				page: tile.page,
				text: tile.text,
				displayText: tile.displayText,
				backgroundColor: tile.backgroundColor,
				borderColor: tile.borderColor,
				image: tile.image,
				navigation: tile.navigation,
			}));

			// Update TilePage with JSON tiles
			await prisma.tilePage.update({
				where: { id: tilePage.id },
				data: { tiles: tilesJson },
			});

			totalTiles += tiles.length;
			successCount++;
			console.log(`✓ Migrated "${tilePage.name}" (${tilePage.id}): ${tiles.length} tiles`);
		} catch (error) {
			errorCount++;
			console.error(`✗ Failed to migrate "${tilePage.name}" (${tilePage.id}):`, error);
		}
	}

	console.log('\n--- Migration Summary ---');
	console.log(`Total tile pages: ${tilePages.length}`);
	console.log(`Successfully migrated: ${successCount}`);
	console.log(`Failed: ${errorCount}`);
	console.log(`Total tiles migrated: ${totalTiles}`);

	if (errorCount === 0) {
		console.log('\n✓ Migration completed successfully!');
		console.log('\nNext steps:');
		console.log('1. Test the application to verify tiles load correctly');
		console.log('2. Update all tile routes to use JSON operations');
		console.log('3. Run: npx prisma db push (or create migration) to drop Tile table');
		console.log('\nTo drop the Tile table after verification:');
		console.log('   DROP TABLE "Tile";');
	} else {
		console.log('\n⚠ Migration completed with errors. Please investigate before dropping Tile table.');
	}
}

async function verifyMigration() {
	console.log('\n--- Verifying Migration ---\n');

	// Check a few tile pages to ensure JSON tiles are valid
	const samplePages = await prisma.tilePage.findMany({
		take: 5,
		select: { id: true, name: true, tiles: true },
	});

	for (const page of samplePages) {
		const tiles = page.tiles as TileData[];
		if (!Array.isArray(tiles)) {
			console.error(`✗ Page "${page.name}" has invalid tiles format`);
			continue;
		}

		// Validate tile structure
		const validTiles = tiles.every(
			(t) =>
				typeof t.x === 'number' && typeof t.y === 'number' && typeof t.page === 'number' && typeof t.text === 'string',
		);

		if (validTiles) {
			console.log(`✓ Page "${page.name}": ${tiles.length} valid tiles`);
		} else {
			console.error(`✗ Page "${page.name}": Some tiles have invalid structure`);
		}
	}
}

// Main execution
migrateTilesToJson()
	.then(() => verifyMigration())
	.catch(console.error)
	.finally(() => prisma.$disconnect());
