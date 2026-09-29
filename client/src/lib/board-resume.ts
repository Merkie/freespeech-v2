import type { ProjectBlob, Tile } from './types';

export function getHomePageId(blob: Pick<ProjectBlob, 'homePageId' | 'pages'>): string {
	if (blob.pages.some((page) => page.id === blob.homePageId)) return blob.homePageId!;
	return blob.pages.find((page) => page.name.trim().toLowerCase() === 'home')?.id ?? blob.pages[0]?.id ?? '';
}

export function resolveResumePage(blob: ProjectBlob, explicit?: string, saved?: string): string {
	for (const id of [explicit, saved]) if (id && blob.pages.some((page) => page.id === id)) return id;
	return getHomePageId(blob);
}

export type BoardResume = { projectId: string; pageId: string; sentence: Tile[]; scroll: number };
export function readBoardResume(): BoardResume | null {
	try {
		const saved = JSON.parse(localStorage.getItem('freespeech-resume') ?? 'null');
		if (!saved || typeof saved.projectId !== 'string' || typeof saved.pageId !== 'string') return null;
		return {
			projectId: saved.projectId,
			pageId: saved.pageId,
			sentence: Array.isArray(saved.sentence)
				? saved.sentence.filter((tile: Tile) => tile && typeof tile.text === 'string').slice(0, 500)
				: [],
			scroll: Number.isFinite(saved.scroll) ? Math.max(0, saved.scroll) : 0,
		};
	} catch {
		return null;
	}
}

export function saveBoardResume(state: BoardResume): void {
	try {
		localStorage.setItem('freespeech-resume', JSON.stringify(state));
	} catch {
		/* Optional on restricted devices. */
	}
}
