export const account = {
	id: 'fixture-user',
	name: 'Fixture',
	email: 'fixture@example.invalid',
	profileImgUrl: null,
	createdAt: '2026-01-01T00:00:00.000Z',
	updatedAt: '2026-01-01T00:00:00.000Z',
};
export const controls = {
	enabled: false,
	mode: 'pin',
	pinHash: null,
	pinSalt: null,
	updatedAt: null,
	collaborationEnabled: false,
};
export const board = {
	id: 'fixture-board',
	name: 'Fixture board',
	description: null,
	imageUrl: null,
	columns: 2,
	rows: 2,
	homePageId: 'page-0',
	lastEditedAt: '2026-01-01T00:00:00.000Z',
	pages: Array.from({ length: 230 }, (_, i) => ({
		id: `page-${i}`,
		name: `Page ${i}`,
		tiles: [
			{ x: 0, y: 0, page: 0, text: `Tile ${i}`, image: `http://127.0.0.1:5188/images/${i}.png`, navigation: '' },
			{ x: 1, y: 0, page: 0, text: 'Next page', navigation: `page-${(i + 1) % 230}` },
		],
	})),
};
