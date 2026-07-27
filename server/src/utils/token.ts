import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './env';

export function generateToken(userId: string) {
	const token = jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '30d' });

	return {
		token,
	};
}

export function verifyToken(token: string) {
	let userId = '';

	try {
		const payload = jwt.verify(token, JWT_SECRET);
		userId = (payload as { id: string }).id || '';
	} catch {}

	if (!userId) return null;

	return userId;
}

// Password reset tokens are signed with the user's CURRENT password hash mixed into the key.
// That makes a link single-use by nature: once the password changes the hash changes, so every
// previously issued token stops verifying. No reset table to store, expire, or clean up.
export function generatePasswordResetToken(userId: string, passwordHash: string) {
	return jwt.sign({ id: userId, purpose: 'password-reset' }, JWT_SECRET + passwordHash, {
		expiresIn: '1h',
	});
}

export function verifyPasswordResetToken(token: string, passwordHash: string) {
	try {
		const payload = jwt.verify(token, JWT_SECRET + passwordHash) as {
			id?: string;
			purpose?: string;
		};
		if (payload.purpose !== 'password-reset' || !payload.id) return null;
		return payload.id;
	} catch {
		return null;
	}
}

// Reads the user id out of a token WITHOUT verifying the signature, purely so the user's
// password hash can be looked up and the token then verified properly against it.
export function readUnverifiedUserId(token: string) {
	const decoded = jwt.decode(token) as { id?: string } | null;
	return decoded?.id || null;
}
