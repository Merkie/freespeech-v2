import { afterAll, beforeAll, expect, test } from 'bun:test';
import express from 'express';
import { isTrustedProxy } from '../src/utils/ip';
import { clientIp, RateLimiter } from '../src/utils/rate-limit';

let server: ReturnType<ReturnType<typeof express>['listen']>;
let origin = '';

beforeAll(async () => {
	const app = express();
	app.set('trust proxy', (address: string) => isTrustedProxy(address));
	app.get('/ip', (req, res) => res.send(clientIp(req)));
	server = app.listen(0, '127.0.0.1');
	await new Promise<void>((resolve) => server.once('listening', resolve));
	origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(() => server?.close());

const ipFor = async (forwardedFor?: string) =>
	(await fetch(`${origin}/ip`, { headers: forwardedFor ? { 'X-Forwarded-For': forwardedFor } : {} })).text();

test('uses the visitor address behind Cloudflare and nginx', async () => {
	// nginx appends the Cloudflare edge; Cloudflare supplied the visitor.
	expect(await ipFor('198.51.100.7, 172.70.1.2')).toBe('198.51.100.7');
	// A visitor-supplied header in front of Cloudflare's entry is ignored.
	expect(await ipFor('1.1.1.1, 198.51.100.7, 172.70.1.2')).toBe('198.51.100.7');
});

test('a request that bypasses Cloudflare cannot choose its address', async () => {
	// nginx saw 203.0.113.9 directly; the forged left-hand value is not trusted.
	expect(await ipFor('1.1.1.1, 203.0.113.9')).toBe('203.0.113.9');
});

test('local requests without proxies use the socket address', async () => {
	expect(await ipFor()).toBe('127.0.0.1');
});

test('fixed-window limiter', () => {
	const limiter = new RateLimiter(3, 1000);
	expect([0, 1, 2].map(() => limiter.consume('a', 0))).toEqual([0, 0, 0]);
	expect(limiter.consume('a', 10)).toBe(990);
	expect(limiter.consume('b', 10)).toBe(0);
	expect(limiter.consume('a', 1000)).toBe(0);
	limiter.reset('a');
	expect(limiter.retryAfter('a', 1001)).toBe(0);
});
