import { afterAll, beforeAll, expect, test } from 'bun:test';
import express from 'express';
import prisma from '../src/resources/prisma';
import { GET } from '../src/routes/project/[id]/blob';
import { nextProjectVersion } from '../src/utils/locked-project';
import { applyProjectBlob, buildProjectBlob, type ProjectBlob } from '../src/utils/project-blob';
import { generateToken } from '../src/utils/token';

// These tests create/delete fixtures. Refuse every DB except an explicitly selected local test DB.
const database = new URL(process.env.DATABASE_URL ?? '');
if (!['127.0.0.1', 'localhost'].includes(database.hostname) || database.pathname !== '/freespeech_v2_test') {
	throw new Error('Run with a local DATABASE_URL ending in /freespeech_v2_test');
}
const owner = `sync-owner-${crypto.randomUUID()}`;
const other = `sync-other-${crypto.randomUUID()}`;
let server: ReturnType<ReturnType<typeof express>['listen']>;
let origin = '';
let board: ProjectBlob;
let projectId = '';
beforeAll(async () => {
	await prisma.user.createMany({
		data: [owner, other].map((id) => ({ id, name: id, email: `${id}@example.invalid` })),
	});
	const row = await prisma.project.create({
		data: {
			userId: owner,
			name: 'Race test',
			blob: {
				name: 'Race test',
				description: null,
				imageUrl: null,
				columns: 2,
				rows: 2,
				homePageId: 'home',
				pages: [{ id: 'home', name: 'Home', tiles: [] }],
			},
		},
	});
	projectId = row.id;
	board = (await buildProjectBlob(row.id, owner))!;
	const app = express();
	app.get('/project/:id/blob', ...GET);
	server = app.listen(0, '127.0.0.1');
	await new Promise<void>((resolve) => server.once('listening', resolve));
	origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(async () => {
	server?.close();
	await prisma.user.deleteMany({ where: { id: { in: [owner, other] } } });
	await prisma.$disconnect();
});
test('simultaneous full-board saves have one winner and one conflict', async () => {
	for (let i = 0; i < 8; i++) {
		const current = (await buildProjectBlob(projectId, owner))!;
		const edits = ['Device A', 'Device B'].map((name) => ({ ...current, name: `${name} ${i}` }));
		const results = await Promise.all(
			edits.map((blob) => applyProjectBlob(projectId, owner, blob, current.lastEditedAt)),
		);
		expect(results.filter((result) => result.success)).toHaveLength(1);
		expect(results.filter((result) => result.conflict)).toHaveLength(1);
		const stored = (await buildProjectBlob(projectId, owner))!;
		expect(stored.name).toBe(edits[results.findIndex((result) => result.success)].name);
		expect(stored.lastEditedAt > current.lastEditedAt).toBe(true);
	}
});
test('a fabricated future version cannot bypass conflict detection', async () => {
	const result = await applyProjectBlob(projectId, owner, board, '2999-01-01T00:00:00.000Z');
	expect(result.conflict).toBe(true);
});
test('versions advance even when the previous version is ahead of the system clock', () => {
	const future = new Date(Date.now() + 10000);
	expect(nextProjectVersion(future).getTime()).toBe(future.getTime() + 1);
});
test('conditional GET returns no body for an unchanged authorized board', async () => {
	const headers = { Authorization: `Bearer ${generateToken(owner).token}` };
	const first = await fetch(`${origin}/project/${projectId}/blob`, { headers });
	expect(first.status).toBe(200);
	const etag = first.headers.get('etag')!;
	expect(etag).toBeTruthy();
	const unchanged = await fetch(`${origin}/project/${projectId}/blob`, {
		headers: { ...headers, 'If-None-Match': etag },
	});
	expect(unchanged.status).toBe(304);
	expect(await unchanged.text()).toBe('');
	await prisma.project.update({ where: { id: projectId }, data: { imageUrl: '/new-thumbnail' } });
	const changed = await fetch(`${origin}/project/${projectId}/blob`, {
		headers: { ...headers, 'If-None-Match': etag },
	});
	expect(changed.status).toBe(200);
	expect(changed.headers.get('etag')).not.toBe(etag);
	const forbidden = await fetch(`${origin}/project/${projectId}/blob`, {
		headers: { Authorization: `Bearer ${generateToken(other).token}`, 'If-None-Match': etag },
	});
	expect(forbidden.status).toBe(404);
});
