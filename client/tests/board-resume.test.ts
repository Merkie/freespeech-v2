import { expect, test } from 'bun:test';
import { getHomePageId, resolveResumePage } from '../src/lib/board-resume';
import type { ProjectBlob } from '../src/lib/types';

const board = {
	homePageId: 'custom',
	pages: [
		{ id: 'old', name: 'Home' },
		{ id: 'custom', name: 'Food' },
		{ id: 'last', name: 'Play' },
	],
} as ProjectBlob;
test('home is selected by ID despite another page named Home', () => expect(getHomePageId(board)).toBe('custom'));
test('explicit deep link wins over last page', () => expect(resolveResumePage(board, 'old', 'last')).toBe('old'));
test('cold launch restores last page', () => expect(resolveResumePage(board, undefined, 'last')).toBe('last'));
test('removed last page falls back to home', () =>
	expect(resolveResumePage(board, undefined, 'deleted')).toBe('custom'));
test('invalid home ID recovers to an existing Home page', () =>
	expect(getHomePageId({ ...board, homePageId: 'deleted' })).toBe('old'));
