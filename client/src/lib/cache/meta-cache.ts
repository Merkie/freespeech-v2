import type { User } from '../types';
import { getDB } from './db';

const AUTH_TOKEN_KEY = 'authToken';
const AUTH_USER_KEY = 'authUser';

type CachedAuthUser = Pick<
	User,
	'id' | 'email' | 'name' | 'profileImgUrl' | 'usePersonalElevenLabsKey' | 'createdAt' | 'updatedAt'
>;

export async function cacheAuthToken(token: string): Promise<void> {
	const db = await getDB();
	await db.put('meta', { key: AUTH_TOKEN_KEY, value: token });
}

export async function getCachedAuthToken(): Promise<string | null> {
	const db = await getDB();
	const entry = await db.get('meta', AUTH_TOKEN_KEY);
	return entry?.value ?? null;
}

/**
 * Keeps just enough profile data to render an authenticated shell after a cold offline launch.
 * Password and ElevenLabs credentials are deliberately excluded from the device cache.
 */
export async function cacheAuthUser(user: User): Promise<void> {
	const cached: CachedAuthUser = {
		id: user.id,
		email: user.email,
		name: user.name,
		profileImgUrl: user.profileImgUrl,
		usePersonalElevenLabsKey: user.usePersonalElevenLabsKey,
		createdAt: user.createdAt,
		updatedAt: user.updatedAt,
	};

	const db = await getDB();
	await db.put('meta', { key: AUTH_USER_KEY, value: JSON.stringify(cached) });
}

export async function getCachedAuthUser(): Promise<User | null> {
	try {
		const db = await getDB();
		const entry = await db.get('meta', AUTH_USER_KEY);
		if (!entry?.value) return null;

		const cached = JSON.parse(entry.value) as CachedAuthUser;
		if (!cached.id || !cached.email || !cached.name) return null;

		return {
			...cached,
			password: null,
			elevenLabsApiKey: null,
		};
	} catch {
		return null;
	}
}

export async function clearCachedAuth(): Promise<void> {
	const db = await getDB();
	const transaction = db.transaction('meta', 'readwrite');
	await Promise.all([
		transaction.store.delete(AUTH_TOKEN_KEY),
		transaction.store.delete(AUTH_USER_KEY),
		transaction.done,
	]);
}
