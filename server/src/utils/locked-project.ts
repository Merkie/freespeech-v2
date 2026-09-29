import type { Prisma } from '@prisma/client';
import prisma from '@/resources/prisma';

/** Serialize the version check and write, including other PostgreSQL UPDATE writers. */
export function withLockedProject<T>(id: string, action: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
	return prisma.$transaction(async (tx) => {
		await tx.$queryRaw`SELECT id FROM "Project" WHERE id = ${id} FOR UPDATE`;
		return action(tx);
	});
}

// DateTime is stored at millisecond precision. Two writes in one millisecond still need
// distinct versions, including when the wall clock moves backwards.
export function nextProjectVersion(previous: Date): Date {
	return new Date(Math.max(Date.now(), previous.getTime() + 1));
}
