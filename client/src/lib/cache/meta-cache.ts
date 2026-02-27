import { getDB } from './db';

export async function cacheAuthToken(token: string): Promise<void> {
	const db = await getDB();
	await db.put('meta', { key: 'authToken', value: token });
}

export async function getCachedAuthToken(): Promise<string | null> {
	const db = await getDB();
	const entry = await db.get('meta', 'authToken');
	return entry?.value ?? null;
}
