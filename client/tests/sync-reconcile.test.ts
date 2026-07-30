import { describe, expect, test } from 'bun:test';
import { reconcileSuccessfulSync } from '../src/lib/sync-reconcile';
import type { CachedProjectBlob } from '../src/lib/types';

function cachedEntry(revision?: number): CachedProjectBlob {
	return {
		id: 'project-1',
		cachedAt: 1,
		dirty: true,
		revision,
		blob: {
			id: 'project-1',
			name: 'Board',
			description: null,
			imageUrl: null,
			columns: 4,
			rows: 3,
			homePageId: 'page-1',
			lastEditedAt: '2026-01-01T00:00:00.000Z',
			pages: [{ id: 'page-1', name: 'Home', tiles: [] }],
		},
	};
}

describe('reconcileSuccessfulSync', () => {
	test('marks the exact revision sent to the server clean', () => {
		const result = reconcileSuccessfulSync(cachedEntry(4), 4, '2026-01-02T00:00:00.000Z');

		expect(result.needsAnotherSync).toBe(false);
		expect(result.entry.dirty).toBe(false);
		expect(result.entry.revision).toBe(4);
		expect(result.entry.blob.lastEditedAt).toBe('2026-01-02T00:00:00.000Z');
	});

	test('rebases but does not clean a newer local revision', () => {
		const result = reconcileSuccessfulSync(cachedEntry(5), 4, '2026-01-02T00:00:00.000Z');

		expect(result.needsAnotherSync).toBe(true);
		expect(result.entry.dirty).toBe(true);
		expect(result.entry.revision).toBe(5);
		expect(result.entry.blob.lastEditedAt).toBe('2026-01-02T00:00:00.000Z');
	});

	test('normalizes records created before revisions were introduced', () => {
		const result = reconcileSuccessfulSync(cachedEntry(), 0, '2026-01-02T00:00:00.000Z');

		expect(result.needsAnotherSync).toBe(false);
		expect(result.entry.dirty).toBe(false);
		expect(result.entry.revision).toBe(0);
	});
});
