import prisma from '@/resources/prisma';

/**
 * Update lastEditedAt timestamp for projects connected to a TilePage.
 * Call this after modifying tiles to enable client-side cache invalidation.
 */
export async function updateProjectLastEditedAt(tilePageId: string): Promise<void> {
	// Find all projects that contain this page
	const connections = await prisma.tilePageInProject.findMany({
		where: { tilePageId },
		select: { projectId: true },
	});

	if (connections.length === 0) return;

	// Update lastEditedAt for all connected projects
	await prisma.project.updateMany({
		where: {
			id: { in: connections.map((c) => c.projectId) },
		},
		data: {
			lastEditedAt: new Date(),
		},
	});
}
