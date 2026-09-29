import { beforeEach, expect, mock, test } from 'bun:test';
import 'fake-indexeddb/auto';
import type { ProjectBlob } from '../src/lib/types';

let fetched = 0;
let sent: ProjectBlob[] = [];
let respondSync: ((value: any) => void) | undefined;
let fetchBlob = async (_id: string, _etag?: string): Promise<any> => {
	fetched++;
	return new Promise(() => {});
};
mock.module('../src/lib/api', () => ({
	default: {
		project: {
			fetchBlob: (id: string, etag?: string) => fetchBlob(id, etag),
			syncBlob: async (_id: string, blob: ProjectBlob) => {
				sent.push(structuredClone(blob));
				return new Promise((resolve) => {
					respondSync = resolve;
				});
			},
		},
	},
}));
Object.defineProperty(globalThis, 'localStorage', { value: { getItem: () => 'test-token' }, configurable: true });
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });
const { cacheBlob, cacheDraft, getCachedBlobEntry } = await import('../src/lib/cache/blob-cache');
const { getDB } = await import('../src/lib/cache/db');
const { setProjectBlob, projectBlob } = await import('../src/lib/state');
const sync = await import('../src/lib/blob-sync');
const board: ProjectBlob = {
	id: 'board',
	name: 'Board',
	description: null,
	imageUrl: null,
	columns: 2,
	rows: 2,
	homePageId: 'home',
	lastEditedAt: '2026-01-01T00:00:00.000Z',
	pages: [{ id: 'home', name: 'Home', tiles: [] }],
};
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
beforeEach(async () => {
	await sync.resetBlobSession();
	await (await getDB()).clear('projectBlobs');
	setProjectBlob(null);
	fetched = 0;
	sent = [];
	respondSync = undefined;
	fetchBlob = async () => {
		fetched++;
		return new Promise(() => {});
	};
});
test('cached startup returns without starting or awaiting any network request', async () => {
	await cacheBlob(board);
	expect(await sync.loadProjectBlob(board.id)).toBe(true);
	expect(projectBlob()).toEqual(board);
	expect(fetched).toBe(0);
});
test('restart uses the committed board; draft recovery requires entering editing', async () => {
	await cacheBlob(board);
	await cacheDraft(board.id, { ...board, name: 'Unfinished draft' });
	await sync.loadProjectBlob(board.id);
	expect(projectBlob()?.name).toBe('Board');
	expect(await sync.enterEditMode()).toBe(true);
	expect(projectBlob()?.name).toBe('Unfinished draft');
	expect(sync.draftRecovered()).toBe(true);
	await sync.discardEditMode();
	expect(projectBlob()?.name).toBe('Board');
	expect((await getCachedBlobEntry(board.id))?.draft).toBeUndefined();
});
test('background sync never publishes an editor draft', async () => {
	await cacheBlob(board, true);
	setProjectBlob(board);
	await sync.enterEditMode();
	sync.mutateBlob((blob) => {
		blob.name = 'Private draft';
	});
	const request = sync.syncBlobToServer();
	await settle();
	expect(sent[0].name).toBe('Board');
	respondSync!({ success: true, lastEditedAt: '2026-01-01T00:00:00.001Z' });
	await request;
	const entry = await getCachedBlobEntry(board.id);
	expect(entry?.dirty).toBe(false);
	expect(entry?.blob.name).toBe('Board');
	expect(entry?.draft?.name).toBe('Private draft');
	expect(projectBlob()?.name).toBe('Private draft');
});
test('Save waits for durable data and clears the draft', async () => {
	await cacheBlob(board);
	setProjectBlob(board);
	await sync.enterEditMode();
	sync.mutateBlob((blob) => {
		blob.name = 'Saved draft';
	});
	await sync.saveEditMode();
	const entry = await getCachedBlobEntry(board.id);
	expect(entry?.blob.name).toBe('Saved draft');
	expect(entry?.dirty).toBe(true);
	expect(entry?.draft).toBeUndefined();
	await settle();
	respondSync!({ success: true, lastEditedAt: '2026-01-01T00:00:00.001Z' });
	await settle();
});
test('a delayed GET cannot replace a new edit', async () => {
	await cacheBlob(board);
	setProjectBlob(board);
	let respond!: (value: any) => void;
	fetchBlob = async () =>
		new Promise((resolve) => {
			respond = resolve;
		});
	const request = sync.checkAndRevalidate(board.id);
	await settle();
	sync.mutateBlob((blob) => {
		blob.name = 'New local edit';
	});
	respond({ blob: { ...board, name: 'Remote copy' } });
	expect(await request).toBe(false);
	expect(projectBlob()?.name).toBe('New local edit');
	await settle();
	expect((await getCachedBlobEntry(board.id))?.blob.name).toBe('New local edit');
});
test('a cancelled load cannot replace the board after navigation', async () => {
	let respond!: (value: any) => void;
	fetchBlob = async () =>
		new Promise((resolve) => {
			respond = resolve;
		});
	let current = true;
	const load = sync.loadProjectBlob(board.id, () => current);
	await settle();
	current = false;
	setProjectBlob({ ...board, id: 'other' });
	respond({ blob: board });
	expect(await load).toBe(false);
	expect(projectBlob()?.id).toBe('other');
});

test('edits made during a save are sent next with the acknowledged version', async () => {
	await cacheBlob(board, true);
	setProjectBlob(board);
	const request = sync.syncBlobToServer();
	await settle();
	sync.mutateBlob((blob) => {
		blob.name = 'Newer edit';
	});
	await settle();
	respondSync!({ success: true, lastEditedAt: '2026-01-01T00:00:00.001Z' });
	await settle();
	expect(sent).toHaveLength(2);
	expect(sent[1].name).toBe('Newer edit');
	expect(sent[1].lastEditedAt).toBe('2026-01-01T00:00:00.001Z');
	respondSync!({ success: true, lastEditedAt: '2026-01-01T00:00:00.002Z' });
	await request;
	expect((await getCachedBlobEntry(board.id))?.dirty).toBe(false);
	expect(projectBlob()?.name).toBe('Newer edit');
});

test('clearing the download cache preserves dirty boards and editor drafts', async () => {
	const { clearCache } = await import('../src/lib/cache/db');
	await cacheBlob(board);
	await cacheDraft(board.id, { ...board, name: 'Draft' });
	await cacheBlob({ ...board, id: 'dirty' }, true);
	await cacheBlob({ ...board, id: 'clean' });
	await clearCache();
	expect((await getCachedBlobEntry(board.id))?.draft?.name).toBe('Draft');
	expect((await getCachedBlobEntry('dirty'))?.dirty).toBe(true);
	expect(await getCachedBlobEntry('clean')).toBeNull();
});

test('a new IndexedDB edit wins over a first-load GET from another context', async () => {
	let respond!: (value: any) => void;
	fetchBlob = async () =>
		new Promise((resolve) => {
			respond = resolve;
		});
	const load = sync.loadProjectBlob(board.id);
	await settle();
	await cacheBlob({ ...board, name: 'Another tab edit' }, true);
	respond({ blob: board });
	expect(await load).toBe(true);
	expect(projectBlob()?.name).toBe('Another tab edit');
	expect((await getCachedBlobEntry(board.id))?.dirty).toBe(true);
});

test('revalidation adopts an already updated clean device copy without losing it to a 304', async () => {
	setProjectBlob(board);
	await cacheBlob({ ...board, name: 'Updated by another context', lastEditedAt: '2026-01-01T00:00:00.001Z' });
	expect(await sync.checkAndRevalidate(board.id)).toBe(true);
	expect(projectBlob()?.name).toBe('Updated by another context');
	expect(fetched).toBe(0);
});
