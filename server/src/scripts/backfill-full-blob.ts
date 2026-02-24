/**
 * Backfill script: Merge project-level fields into blob column.
 *
 * Existing blobs only store `{ pages: [...] }`. This script reads
 * name, description, imageUrl, columns, rows, homePageId from the
 * direct columns and writes them into each blob so the blob column
 * becomes the full source of truth.
 *
 * Safe to re-run — skips projects whose blob already has a `name` field.
 *
 * Usage: npx tsx src/scripts/backfill-full-blob.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
	const projects = await prisma.project.findMany({
		select: {
			id: true,
			name: true,
			description: true,
			imageUrl: true,
			columns: true,
			rows: true,
			homePageId: true,
			blob: true,
		},
	});

	let updated = 0;
	let skipped = 0;

	for (const project of projects) {
		const blob = project.blob as Record<string, unknown>;

		// Skip if already backfilled
		if (blob && typeof blob.name === 'string') {
			skipped++;
			continue;
		}

		const fullBlob = {
			name: project.name,
			description: project.description ?? null,
			imageUrl: project.imageUrl ?? null,
			columns: project.columns,
			rows: project.rows,
			homePageId: project.homePageId ?? null,
			pages: (blob?.pages as unknown[]) ?? [],
		};

		await prisma.project.update({
			where: { id: project.id },
			data: { blob: fullBlob },
		});

		updated++;
	}

	console.log(`Done. Updated: ${updated}, Skipped (already backfilled): ${skipped}`);
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
