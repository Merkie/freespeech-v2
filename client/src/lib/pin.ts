/**
 * Passcode gate for edit mode and the dashboard, in the spirit of iOS Guided Access.
 *
 * This is intentionally a SOFT UI control and is NOT authorization for the API. A 4-digit PIN
 * has a tiny keyspace, so even a salted verifier cached for offline entry is not real security
 * against someone with devtools. It exists to stop accidental editing or dashboard navigation.
 *
 * The database is authoritative for whether the account is locked, its mode, and its verifier.
 * Each signed-in device caches those settings in IndexedDB so the existing gate works offline.
 * Changing the setting requires a connection, avoiding conflicting offline account mutations.
 *
 * A single lockout covers both PIN entry and the multiplication reset: 3 wrong answers of
 * either kind starts a 5-minute lockout. Attempts remain device-local and are keyed by account.
 */

import api from './api';
import { cacheAccessControlSettings, getCachedAccessControlSettings } from './cache/access-control-cache';
import {
	accessControlSettings,
	DEFAULT_ACCESS_CONTROL_SETTINGS,
	setAccessControlSettings,
	setAccessControlSettingsLoaded,
	user,
} from './state';
import type { AccessControlSettings } from './types';

export const PIN_LENGTH = 4;
export const MAX_PIN_ATTEMPTS = 3;
export const PIN_LOCKOUT_MS = 5 * 60 * 1000;

function toHex(buffer: ArrayBuffer): string {
	return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPin(pin: string, salt: string): Promise<string> {
	const data = new TextEncoder().encode(`${salt}:${pin}`);
	const digest = await crypto.subtle.digest('SHA-256', data);
	return toHex(digest);
}

function randomSalt(): string {
	return toHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
}

type AccessControlRuntime = {
	settingsUpdatedAt: string | null;
	failureCount: number;
	lockoutUntil: number;
};

function runtimeKey(): string | null {
	const userId = user()?.id;
	return userId ? `accessControlRuntime:${userId}` : null;
}

function readRuntime(): AccessControlRuntime {
	const empty = {
		settingsUpdatedAt: accessControlSettings().updatedAt,
		failureCount: 0,
		lockoutUntil: 0,
	};
	const key = runtimeKey();
	if (!key) return empty;

	try {
		const value = localStorage.getItem(key);
		if (!value) return empty;
		const saved = JSON.parse(value) as AccessControlRuntime;
		if (saved.settingsUpdatedAt !== accessControlSettings().updatedAt) return empty;
		return saved;
	} catch {
		return empty;
	}
}

function writeRuntime(runtime: AccessControlRuntime): void {
	const key = runtimeKey();
	if (key) localStorage.setItem(key, JSON.stringify(runtime));
}

function replaceSettings(settings: AccessControlSettings): void {
	// Older offline caches predate collaborationEnabled. Merge defaults so an upgraded PWA
	// never exposes an undefined toggle while it is waiting to reconnect.
	setAccessControlSettings({ ...DEFAULT_ACCESS_CONTROL_SETTINGS, ...settings });
}

/** Prefer the account record, falling back to this account's last IndexedDB copy when offline. */
export async function hydrateAccessControlSettings(userId: string): Promise<void> {
	setAccessControlSettingsLoaded(false);
	try {
		const settings = await api.user.getAccessControls();
		replaceSettings(settings);
		await cacheAccessControlSettings(userId, settings).catch(() => undefined);
	} catch {
		const cached = await getCachedAccessControlSettings(userId);
		replaceSettings(cached ?? DEFAULT_ACCESS_CONTROL_SETTINGS);
	} finally {
		setAccessControlSettingsLoaded(true);
	}
}

export function resetAccessControlSettings(): void {
	const key = runtimeKey();
	if (key) localStorage.removeItem(key);
	replaceSettings(DEFAULT_ACCESS_CONTROL_SETTINGS);
	setAccessControlSettingsLoaded(false);
}

export function useDefaultAccessControlSettings(): void {
	replaceSettings(DEFAULT_ACCESS_CONTROL_SETTINGS);
	setAccessControlSettingsLoaded(true);
}

async function saveAccountSettings(
	settings: Pick<AccessControlSettings, 'enabled' | 'mode' | 'pinHash' | 'pinSalt'>,
): Promise<void> {
	const userId = user()?.id;
	if (!userId) throw new Error('No signed-in account');

	// Applied optimistically so the controls respond on tap like the device-local settings do,
	// then reconciled with the server's copy — or rolled back — when the request settles.
	const previous = accessControlSettings();
	replaceSettings({ ...previous, ...settings });
	let saved: AccessControlSettings;
	try {
		saved = await api.user.updateAccessControls(settings);
	} catch (error) {
		replaceSettings(previous);
		throw error;
	}
	replaceSettings(saved);
	clearLockout();
	await cacheAccessControlSettings(userId, saved).catch(() => undefined);
}

/** Turn on the gate using a 4-digit PIN. Clears any outstanding lockout. */
export async function enablePinLock(pin: string): Promise<void> {
	const salt = randomSalt();
	const hash = await hashPin(pin, salt);
	await saveAccountSettings({
		enabled: true,
		mode: 'pin',
		pinHash: hash,
		pinSalt: salt,
	});
}

/**
 * Turn on the gate using a multiplication question. There is no secret to store: anyone who can
 * do the arithmetic gets through, which is the point when the carer does not want to remember a
 * PIN but the person using the board cannot multiply.
 */
export async function enableMathLock(): Promise<void> {
	await saveAccountSettings({
		enabled: true,
		mode: 'math',
		pinHash: null,
		pinSalt: null,
	});
}

/** Turn the gate off and forget the stored PIN. */
export async function disablePinLock(): Promise<void> {
	await saveAccountSettings({
		enabled: false,
		mode: 'pin',
		pinHash: null,
		pinSalt: null,
	});
}

export async function setBoardCollaborationEnabled(enabled: boolean): Promise<void> {
	// Optimistic for the same reason as saveAccountSettings: the switch should move on tap.
	const previous = accessControlSettings();
	replaceSettings({ ...previous, collaborationEnabled: enabled });
	let saved: boolean;
	try {
		saved = await api.user.updateCollaboration(enabled);
	} catch (error) {
		replaceSettings(previous);
		throw error;
	}
	const settings = { ...accessControlSettings(), collaborationEnabled: saved };
	replaceSettings(settings);
	const userId = user()?.id;
	if (userId) await cacheAccessControlSettings(userId, settings).catch(() => undefined);
}

export async function verifyPin(pin: string): Promise<boolean> {
	const settings = accessControlSettings();
	if (!settings.pinHash || !settings.pinSalt) return false;
	const candidate = await hashPin(pin, settings.pinSalt);
	return candidate === settings.pinHash;
}

/** Milliseconds left on the current lockout, or 0 when not locked out. */
export function lockoutRemainingMs(): number {
	return Math.max(0, readRuntime().lockoutUntil - Date.now());
}

/**
 * Record a wrong PIN or a wrong reset answer. The third failure starts the lockout and resets
 * the counter. Returns whether we are now locked out and how many tries remain.
 */
export function registerFailedAttempt(): { lockedOut: boolean; attemptsLeft: number } {
	const runtime = readRuntime();
	const count = runtime.failureCount + 1;

	if (count >= MAX_PIN_ATTEMPTS) {
		writeRuntime({
			settingsUpdatedAt: accessControlSettings().updatedAt,
			failureCount: 0,
			lockoutUntil: Date.now() + PIN_LOCKOUT_MS,
		});
		return { lockedOut: true, attemptsLeft: 0 };
	}

	writeRuntime({
		settingsUpdatedAt: accessControlSettings().updatedAt,
		failureCount: count,
		lockoutUntil: runtime.lockoutUntil,
	});
	return { lockedOut: false, attemptsLeft: MAX_PIN_ATTEMPTS - count };
}

/** Clear the failure count and lockout after a successful entry or reset. */
export function clearLockout(): void {
	writeRuntime({ settingsUpdatedAt: accessControlSettings().updatedAt, failureCount: 0, lockoutUntil: 0 });
}

/** A multiplication challenge with both factors in [2, 9] — easy for an adult, not for a toddler. */
export function makeMultiplicationChallenge(): { a: number; b: number; answer: number } {
	const rand = () => 2 + Math.floor(Math.random() * 8);
	const a = rand();
	const b = rand();
	return { a, b, answer: a * b };
}

/** Whether a gated action should prompt at all. */
export function pinLockActive(): boolean {
	return accessControlSettings().enabled === true;
}

export function formatLockoutRemaining(ms: number): string {
	const total = Math.ceil(ms / 1000);
	const minutes = Math.floor(total / 60);
	const seconds = total % 60;
	return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
