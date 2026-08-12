import type { Prisma } from '@prisma/client';
import prisma from '@/resources/prisma';

/**
 * Owners always retain access. Accepted collaborators have access only while the
 * board owner's account-level collaboration switch is enabled.
 */
export function projectAccessWhere(projectId: string, userId: string): Prisma.ProjectWhereInput {
	return {
		id: projectId,
		OR: [
			{ userId },
			{
				user: { collaborationEnabled: true },
				collaborators: { some: { userId, status: 'ACCEPTED' } },
			},
		],
	};
}

export async function getProjectAccess(projectId: string, userId: string) {
	const project = await prisma.project.findFirst({
		where: projectAccessWhere(projectId, userId),
		select: {
			id: true,
			userId: true,
			collaborators: {
				where: { userId, status: 'ACCEPTED' },
				select: { id: true, isFavorite: true },
			},
		},
	});

	if (!project) return null;
	return {
		...project,
		role: project.userId === userId ? ('owner' as const) : ('collaborator' as const),
	};
}
