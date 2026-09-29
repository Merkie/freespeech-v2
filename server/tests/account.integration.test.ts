import { afterAll, beforeAll, expect, test } from 'bun:test';
import bcrypt from 'bcryptjs';
import express from 'express';
import prisma from '../src/resources/prisma';
import s3 from '../src/resources/s3';
import { POST as login } from '../src/routes/auth/login';
import { POST as deleteAccountRoute } from '../src/routes/user/delete-account';
import { GET as exportRoute } from '../src/routes/user/export';
import { collectOwnedMediaKeys, isOwnedKey, mediaKey } from '../src/utils/account-data';
import { authLimits } from '../src/utils/rate-limit';
import { generateToken } from '../src/utils/token';

// These tests create/delete fixtures. Refuse every DB except an explicitly selected local test DB.
const database = new URL(process.env.DATABASE_URL ?? '');
if (!['127.0.0.1', 'localhost'].includes(database.hostname) || database.pathname !== '/freespeech_v2_test') {
	throw new Error('Run with a local DATABASE_URL ending in /freespeech_v2_test');
}

const run = crypto.randomUUID().slice(0, 8);
const owner = `acct-owner-${run}`;
const google = `acct-google-${run}`;
const other = `acct-other-${run}`;
const media = 'https://media.freespeechaac.com';
const ownedTile = `owner-${owner}/1-apple-512.webp`;
const sharedTile = `owner-${owner}/2-shared-512.webp`;
const ownedThumb = `owner-${owner}/3-thumbnail.png`;
const deletedObjects: string[] = [];
let server: ReturnType<ReturnType<typeof express>['listen']>;
let origin = '';

// No R2 in tests: record deletions, and make listings empty.
(s3 as unknown as { send: (command: { input: Record<string, unknown> }) => Promise<unknown> }).send = async (
	command,
) => {
	const objects = (command.input.Delete as { Objects: { Key: string }[] } | undefined)?.Objects;
	if (objects) deletedObjects.push(...objects.map((object) => object.Key));
	return { Contents: [], Errors: [] };
};

const blob = (images: string[]) => ({
	name: 'Board',
	description: null,
	imageUrl: null,
	columns: 2,
	rows: 2,
	homePageId: 'home',
	pages: [{ id: 'home', name: 'Home', tiles: images.map((image, x) => ({ x, y: 0, page: 0, text: `t${x}`, image })) }],
});

beforeAll(async () => {
	await prisma.user.createMany({
		data: [
			{ id: owner, name: 'Owner', email: `${owner}@example.invalid`, password: await bcrypt.hash('correct horse', 4) },
			{ id: google, name: 'Google', email: `${google}@example.invalid` },
			{ id: other, name: 'Other', email: `${other}@example.invalid`, collaborationEnabled: true },
		],
	});
	await prisma.user.update({
		where: { id: owner },
		data: { collaborationEnabled: true, elevenLabsApiKey: 'encrypted', editPinHash: 'f'.repeat(64) },
	});
	await prisma.project.create({
		data: {
			id: `p-owner-${run}`,
			userId: owner,
			name: 'Owner board',
			imageUrl: `/${ownedThumb}`,
			blob: blob([
				`${media}/${ownedTile}`,
				`${media}/${sharedTile}`,
				`${media}/template-assets/abc.webp`,
				`${media}/other-${other}/x.webp`,
				`${media}/root-level.png`,
			]),
			collaborators: { create: { userId: other, status: 'ACCEPTED' } },
		},
	});
	// The other account duplicated one of the owner's images into its own board.
	await prisma.project.create({
		data: {
			id: `p-other-${run}`,
			userId: other,
			name: 'Other board',
			blob: blob([`${media}/${sharedTile}`]),
			collaborators: { create: { userId: owner, status: 'ACCEPTED' } },
		},
	});

	const app = express();
	app.set('trust proxy', true);
	app.use(express.json());
	app.post('/auth/login', ...login);
	app.get('/user/export', ...exportRoute);
	app.post('/user/delete-account', ...deleteAccountRoute);
	server = app.listen(0, '127.0.0.1');
	await new Promise<void>((resolve) => server.once('listening', resolve));
	origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});

afterAll(async () => {
	server?.close();
	await prisma.user.deleteMany({ where: { id: { in: [owner, google, other] } } });
	await prisma.$disconnect();
});

const post = (path: string, body: unknown, token?: string, ip = '203.0.113.10') =>
	fetch(`${origin}${path}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'X-Forwarded-For': ip,
			...(token ? { Authorization: `Bearer ${token}` } : {}),
		},
		body: JSON.stringify(body),
	});

test('media ownership is limited to the account prefixes', () => {
	expect(mediaKey(`${media}/${ownedTile}`)).toBe(ownedTile);
	expect(mediaKey(`/${ownedThumb}`)).toBe(ownedThumb);
	expect(mediaKey('https://example.com/a/b.png')).toBeNull();
	expect(isOwnedKey(ownedTile, owner)).toBe(true);
	expect(isOwnedKey(`user-imports/${owner}/h.webp`, owner)).toBe(true);
	expect(isOwnedKey('template-assets/abc.webp', owner)).toBe(false);
	expect(isOwnedKey(`other-${other}/x.webp`, owner)).toBe(false);
	expect(isOwnedKey(`x-not${owner}/y.webp`, owner)).toBe(false);
	expect(isOwnedKey('root-level.png', owner)).toBe(false);
});

test('login is limited per email after repeated failures and a success clears it', async () => {
	const email = `${owner}@example.invalid`;
	for (let i = 0; i < 9; i++) expect((await post('/auth/login', { email, password: 'wrong' })).status).toBe(401);
	expect((await post('/auth/login', { email, password: 'correct horse' })).status).toBe(200);
	for (let i = 0; i < 10; i++) expect((await post('/auth/login', { email, password: 'wrong' })).status).toBe(401);
	const limited = await post('/auth/login', { email: email.toUpperCase(), password: 'correct horse' });
	expect(limited.status).toBe(429);
	expect((await limited.json()).error).toContain('Too many attempts');
	expect(limited.headers.get('retry-after')).toBeTruthy();
	// Another account on the same school network is unaffected.
	expect((await post('/auth/login', { email: `${other}@example.invalid`, password: 'x' })).status).toBe(401);
	authLimits.loginFailuresPerEmail.reset(email);
});

test('export includes boards and account fields but no secrets', async () => {
	const response = await fetch(`${origin}/user/export`, {
		headers: { Authorization: `Bearer ${generateToken(owner).token}` },
	});
	expect(response.status).toBe(200);
	expect(response.headers.get('content-disposition')).toContain('attachment');
	const text = await response.text();
	const data = JSON.parse(text);
	expect(data.account.email).toBe(`${owner}@example.invalid`);
	expect(data.account.hasPassword).toBe(true);
	expect(data.account.hasElevenLabsApiKey).toBe(true);
	expect(data.projects).toHaveLength(1);
	expect(data.projects[0].blob.pages[0].tiles).toHaveLength(5);
	expect(data.projects[0].collaborators[0].status).toBe('ACCEPTED');
	expect(data.sharedWithMe[0].projectName).toBe('Other board');
	expect(text).not.toContain('$2');
	expect(text).not.toContain('encrypted');
	expect(text).not.toContain('f'.repeat(64));
	expect(text).not.toMatch(/pinHash|pinSalt|editPinHash|"password"/);
});

test('collects only the account’s own media keys', async () => {
	expect((await collectOwnedMediaKeys(owner)).sort()).toEqual([ownedTile, sharedTile, ownedThumb].sort());
});

test('deletion requires the password and removes boards, memberships, and unshared media', async () => {
	const token = generateToken(owner).token;
	expect((await post('/user/delete-account', { password: 'wrong' }, token)).status).toBe(403);
	expect((await post('/user/delete-account', { email: `${owner}@example.invalid` }, token)).status).toBe(403);
	expect(await prisma.user.count({ where: { id: owner } })).toBe(1);

	const response = await post('/user/delete-account', { password: 'correct horse' }, token);
	expect(response.status).toBe(200);
	expect(await prisma.user.count({ where: { id: owner } })).toBe(0);
	expect(await prisma.project.count({ where: { userId: owner } })).toBe(0);
	expect(
		await prisma.projectCollaborator.count({ where: { OR: [{ userId: owner }, { projectId: `p-owner-${run}` }] } }),
	).toBe(0);
	// The other account's board, and the image it still uses, are untouched.
	expect(await prisma.project.count({ where: { id: `p-other-${run}` } })).toBe(1);
	expect(deletedObjects.sort()).toEqual([ownedTile, ownedThumb].sort());
	expect((await post('/user/delete-account', { password: 'correct horse' }, token)).status).toBe(404);
});

test('Google-only accounts confirm by typing their email', async () => {
	const token = generateToken(google).token;
	expect((await post('/user/delete-account', { email: 'someone@else.invalid' }, token)).status).toBe(403);
	expect(
		(await post('/user/delete-account', { email: ` ${google.toUpperCase()}@EXAMPLE.INVALID ` }, token)).status,
	).toBe(200);
	expect(await prisma.user.count({ where: { id: google } })).toBe(0);
});

test('imported accounts keep media shared with the original app', async () => {
	const id = `acct-imported-${run}`;
	await prisma.user.create({
		data: { id, name: 'Imported', email: `${id}@example.invalid`, importedFromV1At: new Date() },
	});
	await prisma.project.create({ data: { userId: id, name: 'B', blob: blob([`${media}/imported-${id}/a.webp`]) } });
	deletedObjects.length = 0;
	expect((await post('/user/delete-account', { email: `${id}@example.invalid` }, generateToken(id).token)).status).toBe(
		200,
	);
	expect(await prisma.user.count({ where: { id } })).toBe(0);
	expect(deletedObjects).toEqual([]);
});
