import type { AccessControlSettings } from '../types';
import { getDB } from './db';

const ACCESS_CONTROL_KEY_PREFIX = 'accessControls:';

function cacheKey(userId: string): string {
	return `${ACCESS_CONTROL_KEY_PREFIX}${userId}`;
}

function isAccessControlSettings(value: unknown): value is AccessControlSettings {
	if (!value || typeof value !== 'object') return false;
	const settings = value as Partial<AccessControlSettings>;
	return (
		typeof settings.enabled === 'boolean' &&
		(settings.mode === 'pin' || settings.mode === 'math') &&
		(settings.pinHash === null || typeof settings.pinHash === 'string') &&
		(settings.pinSalt === null || typeof settings.pinSalt === 'string') &&
		(settings.updatedAt === null || typeof settings.updatedAt === 'string')
	);
}

export async function cacheAccessControlSettings(userId: string, settings: AccessControlSettings): Promise<void> {
	const db = await getDB();
	await db.put('meta', { key: cacheKey(userId), value: JSON.stringify(settings) });
}

export async function getCachedAccessControlSettings(userId: string): Promise<AccessControlSettings | null> {
	try {
		const db = await getDB();
		const entry = await db.get('meta', cacheKey(userId));
		if (!entry?.value) return null;

		const settings: unknown = JSON.parse(entry.value);
		return isAccessControlSettings(settings) ? settings : null;
	} catch {
		return null;
	}
}

export async function clearCachedAccessControlSettings(userId: string): Promise<void> {
	const db = await getDB();
	await db.delete('meta', cacheKey(userId));
}
