/**
 * Passcode gate for edit mode and the dashboard, in the spirit of iOS Guided Access.
 *
 * This is intentionally a SOFT, client-only control and is NOT enforced by the API. A 4-digit
 * PIN has a tiny keyspace, so the stored hash is not real security against someone with
 * devtools — it exists to stop an AAC user (often a child, or someone who should not be
 * rearranging their own board) from wandering into edit mode or the dashboard by accident.
 *
 * Keeping it on the device rather than on the account is deliberate: the lock has to work when
 * the device is offline, which is exactly when an AAC board matters most, and a shared iPad is
 * locked per device rather than per login.
 *
 * A single lockout covers both PIN entry and the multiplication reset: 3 wrong answers of
 * either kind starts a 5-minute lockout. The counter and the deadline live in localStorage, so
 * a reload cannot clear them.
 */

import { localSettings, setLocalSettings } from './state';

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

/** Turn on the gate using a 4-digit PIN. Clears any outstanding lockout. */
export async function enablePinLock(pin: string): Promise<void> {
	const salt = randomSalt();
	const hash = await hashPin(pin, salt);
	setLocalSettings({
		...localSettings(),
		editPinEnabled: true,
		editPinMode: 'pin',
		editPinHash: hash,
		editPinSalt: salt,
		editPinFailureCount: 0,
		editPinLockoutUntil: 0,
	});
}

/**
 * Turn on the gate using a multiplication question. There is no secret to store: anyone who can
 * do the arithmetic gets through, which is the point when the carer does not want to remember a
 * PIN but the person using the board cannot multiply.
 */
export function enableMathLock(): void {
	setLocalSettings({
		...localSettings(),
		editPinEnabled: true,
		editPinMode: 'math',
		editPinHash: '',
		editPinSalt: '',
		editPinFailureCount: 0,
		editPinLockoutUntil: 0,
	});
}

/** Turn the gate off and forget the stored PIN. */
export function disablePinLock(): void {
	setLocalSettings({
		...localSettings(),
		editPinEnabled: false,
		editPinMode: 'pin',
		editPinHash: '',
		editPinSalt: '',
		editPinFailureCount: 0,
		editPinLockoutUntil: 0,
	});
}

export async function verifyPin(pin: string): Promise<boolean> {
	const s = localSettings();
	if (!s.editPinHash || !s.editPinSalt) return false;
	const candidate = await hashPin(pin, s.editPinSalt);
	return candidate === s.editPinHash;
}

/** Milliseconds left on the current lockout, or 0 when not locked out. */
export function lockoutRemainingMs(): number {
	return Math.max(0, (localSettings().editPinLockoutUntil || 0) - Date.now());
}

/**
 * Record a wrong PIN or a wrong reset answer. The third failure starts the lockout and resets
 * the counter. Returns whether we are now locked out and how many tries remain.
 */
export function registerFailedAttempt(): { lockedOut: boolean; attemptsLeft: number } {
	const count = (localSettings().editPinFailureCount || 0) + 1;

	if (count >= MAX_PIN_ATTEMPTS) {
		setLocalSettings({
			...localSettings(),
			editPinFailureCount: 0,
			editPinLockoutUntil: Date.now() + PIN_LOCKOUT_MS,
		});
		return { lockedOut: true, attemptsLeft: 0 };
	}

	setLocalSettings({ ...localSettings(), editPinFailureCount: count });
	return { lockedOut: false, attemptsLeft: MAX_PIN_ATTEMPTS - count };
}

/** Clear the failure count and lockout after a successful entry or reset. */
export function clearLockout(): void {
	setLocalSettings({ ...localSettings(), editPinFailureCount: 0, editPinLockoutUntil: 0 });
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
	return localSettings().editPinEnabled === true;
}

export function formatLockoutRemaining(ms: number): string {
	const total = Math.ceil(ms / 1000);
	const minutes = Math.floor(total / 60);
	const seconds = total % 60;
	return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
