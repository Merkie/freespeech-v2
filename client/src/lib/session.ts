import { resetBlobSession } from './blob-sync';
import { cancelBoardImageDownloads } from './board-images';
import { clearCache, getDB } from './cache/db';
import { cacheAuthSession, getCachedAuthUser } from './cache/meta-cache';
import { clearLastVisitedProject } from './page-actions';
import { hydrateAccessControlSettings, resetAccessControlSettings } from './pin';
import { resetProjectState, setDashboardUnlocked, setSessionStatus, setUser } from './state';
import type { User } from './types';

export async function clearDeviceBoards() {
	await cancelBoardImageDownloads();
	await resetBlobSession();
	await clearCache(false);
	clearLastVisitedProject();
	localStorage.removeItem('freespeech-resume');
	sessionStorage.removeItem('freespeech-update-reload-state');
	resetProjectState();
	if ('caches' in window) {
		for (const key of await caches.keys()) {
			if (
				key.startsWith('freespeech-board-images-') ||
				key.startsWith('freespeech-api-') ||
				key.startsWith('freespeech-images-')
			)
				await caches.delete(key);
		}
	}
}

export async function startSession(token: string, account: User) {
	const previous = await getCachedAuthUser();
	if (!previous || previous.id !== account.id) await clearDeviceBoards();
	resetAccessControlSettings();
	localStorage.setItem('token', token);
	await cacheAuthSession(token, account);
	setUser(account);
	setSessionStatus('authenticated');
	setDashboardUnlocked(true);
	void hydrateAccessControlSettings(account.id);
}

export async function endSession(forgetBoards = true) {
	localStorage.removeItem('token');
	setSessionStatus('unauthenticated');
	setDashboardUnlocked(false);
	resetAccessControlSettings();
	setUser(null);
	await resetBlobSession();
	const db = await getDB();
	await db.delete('meta', 'authToken');
	if (forgetBoards) {
		await clearDeviceBoards();
		await db.clear('meta');
	} else resetProjectState();
}
