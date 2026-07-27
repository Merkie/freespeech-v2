/**
 * Prints a password-reset token for a given email. Intended for testing and for support staff
 * helping someone whose reset email is not arriving — it produces exactly the token that
 * /auth/forgot-password would have emailed, without sending anything.
 *
 * Usage: bun scripts/mint-reset-token.ts <email>
 */
import { init } from '../src/utils/env';

init();

const { default: prisma } = await import('../src/resources/prisma');
const { generatePasswordResetToken } = await import('../src/utils/token');
const { CLIENT_HOST } = await import('../src/utils/env');

const email = process.argv[2];
if (!email) {
	console.error('Usage: bun scripts/mint-reset-token.ts <email>');
	process.exit(1);
}

const user = await prisma.user.findFirst({
	where: { email: { equals: email, mode: 'insensitive' } },
});

if (!user) {
	console.error(`No account for ${email}`);
	process.exit(1);
}

if (!user.password) {
	console.error(`${email} is a Google-only account and has no password to reset.`);
	process.exit(1);
}

const token = generatePasswordResetToken(user.id, user.password);
console.log(`${CLIENT_HOST}/login/reset-password?token=${encodeURIComponent(token)}`);

process.exit(0);
