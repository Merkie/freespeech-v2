import { afterAll, beforeAll, expect, test } from 'bun:test';
import express from 'express';
import prisma from '../src/resources/prisma';
import { POST } from '../src/routes/project/[id]/update';
import { generateToken } from '../src/utils/token';

const database = new URL(process.env.DATABASE_URL ?? '');
if (!['127.0.0.1', 'localhost'].includes(database.hostname) || database.pathname !== '/freespeech_v2_test') {
	throw new Error('Run with a local DATABASE_URL ending in /freespeech_v2_test');
}

const run = crypto.randomUUID().slice(0, 8);
const owner = `settings-owner-${run}`;
const collaborator = `settings-collab-${run}`;
const projectId = `settings-board-${run}`;
let server: ReturnType<ReturnType<typeof express>['listen']>;
let origin = '';

beforeAll(async () => {
	await prisma.user.createMany({
		data: [owner, collaborator].map((id) => ({
			id,
			name: id,
			email: `${id}@example.invalid`,
			collaborationEnabled: true,
		})),
	});
	await prisma.project.create({
		data: {
			id: projectId,
			userId: owner,
			name: 'Board',
			columns: 6,
			rows: 4,
			blob: {
				name: 'Board',
				description: null,
				imageUrl: null,
				columns: 6,
				rows: 4,
				homePageId: 'home',
				pages: [{ id: 'home', name: 'Home', tiles: [{ x: 5, y: 3, page: 0, text: 'corner' }] }],
			},
			collaborators: { create: { userId: collaborator, status: 'ACCEPTED' } },
		},
	});
	const app = express();
	app.use(express.json());
	app.post('/project/:id/update', ...POST);
	server = app.listen(0, '127.0.0.1');
	await new Promise<void>((resolve) => server.once('listening', resolve));
	origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});

afterAll(async () => {
	server?.close();
	await prisma.user.deleteMany({ where: { id: { in: [owner, collaborator] } } });
	await prisma.$disconnect();
});

const update = (body: unknown, userId = owner) =>
	fetch(`${origin}/project/${projectId}/update`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${generateToken(userId).token}` },
		body: JSON.stringify(body),
	});

test('owners can rename and grow a board; the blob and version follow', async () => {
	const before = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
	const response = await update({ name: ' Renamed ', columns: 8, rows: 5 });
	expect(response.status).toBe(200);
	const row = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
	expect([row.name, row.columns, row.rows]).toEqual(['Renamed', 8, 5]);
	expect(row.blob).toMatchObject({ name: 'Renamed', columns: 8, rows: 5 });
	expect(row.lastEditedAt.getTime()).toBeGreaterThan(before.lastEditedAt.getTime());
});

test('a size that would hide tiles is refused', async () => {
	const response = await update({ columns: 5 });
	expect(response.status).toBe(409);
	expect((await response.json()).error).toContain('1 tile is outside a 5 × 5 grid');
	expect((await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).columns).toBe(8);
});

test('collaborators cannot change the owner’s board settings', async () => {
	expect((await update({ name: 'Mine now' }, collaborator)).status).toBe(404);
	expect((await update({})).status).toBe(400);
});
