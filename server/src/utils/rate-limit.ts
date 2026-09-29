import type { NextFunction, Request, Response } from 'express';

/**
 * Fixed-window counters kept in this process. The API runs as one systemd process, so memory is
 * the whole picture; a restart simply forgets recent attempts.
 */
export class RateLimiter {
	private readonly entries = new Map<string, { count: number; resetAt: number }>();
	private lastSweep = Date.now();

	constructor(
		readonly limit: number,
		readonly windowMs: number,
	) {}

	private entry(key: string, now: number) {
		if (now - this.lastSweep > this.windowMs) {
			for (const [k, e] of this.entries) if (e.resetAt <= now) this.entries.delete(k);
			this.lastSweep = now;
		}
		const existing = this.entries.get(key);
		if (existing && existing.resetAt > now) return existing;
		const fresh = { count: 0, resetAt: now + this.windowMs };
		this.entries.set(key, fresh);
		return fresh;
	}

	/** Milliseconds until the key may try again, or 0 when it is under the limit. */
	retryAfter(key: string, now = Date.now()): number {
		const entry = this.entry(key, now);
		return entry.count >= this.limit ? entry.resetAt - now : 0;
	}

	hit(key: string, now = Date.now()): void {
		this.entry(key, now).count++;
	}

	/** Counts this attempt and reports the wait if it went over the limit. */
	consume(key: string, now = Date.now()): number {
		const wait = this.retryAfter(key, now);
		if (!wait) this.hit(key, now);
		return wait;
	}

	reset(key: string): void {
		this.entries.delete(key);
	}
}

export function tooManyAttempts(res: Response, waitMs: number) {
	const minutes = Math.max(1, Math.ceil(waitMs / 60_000));
	res.setHeader('Retry-After', Math.ceil(waitMs / 1000).toString());
	return res.status(429).json({
		error: `Too many attempts. Please wait ${minutes} minute${minutes === 1 ? '' : 's'} and try again.`,
	});
}

/** The address Express resolved through trusted proxies (nginx, then Cloudflare). */
export function clientIp(req: Request): string {
	return (req.ip ?? req.socket.remoteAddress ?? 'unknown').replace(/^::ffff:/, '');
}

/** Per-address guard. Limits are generous because a whole school can share one NAT address. */
export function limitByIp(limiter: RateLimiter) {
	return (req: Request, res: Response, next: NextFunction) => {
		const wait = limiter.consume(clientIp(req));
		if (wait) return tooManyAttempts(res, wait);
		next();
	};
}

export function emailKey(email: unknown): string {
	return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

const MINUTE = 60_000;

export const authLimits = {
	loginPerIp: new RateLimiter(300, 15 * MINUTE),
	// Only failed passwords count, and a success clears it. About 10 wrong guesses per 15 minutes.
	loginFailuresPerEmail: new RateLimiter(10, 15 * MINUTE),
	registerPerIp: new RateLimiter(100, 60 * MINUTE),
	registerPerEmail: new RateLimiter(10, 15 * MINUTE),
	forgotPerIp: new RateLimiter(100, 60 * MINUTE),
	forgotPerEmail: new RateLimiter(5, 60 * MINUTE),
	// Password confirmation for account deletion, keyed by account.
	deleteFailuresPerUser: new RateLimiter(10, 15 * MINUTE),
};
