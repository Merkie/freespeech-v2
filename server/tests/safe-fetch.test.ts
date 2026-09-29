import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import http from 'node:http';
import { isPublicAddress, isTrustedProxy } from '../src/utils/ip';
import { SafeFetchError, safeFetch } from '../src/utils/safe-fetch';

describe('isPublicAddress', () => {
	test.each([
		'127.0.0.1',
		'127.255.255.254',
		'10.0.0.1',
		'172.16.0.1',
		'172.31.255.255',
		'192.168.1.1',
		'169.254.169.254',
		'100.64.0.1',
		'100.127.255.255',
		'0.0.0.0',
		'255.255.255.255',
		'224.0.0.1',
		'::',
		'::1',
		'fe80::1',
		'fc00::1',
		'fd12:3456::1',
		'ff02::1',
		'::ffff:127.0.0.1',
		'::ffff:7f00:1',
		'::ffff:169.254.169.254',
		'64:ff9b::a9fe:a9fe',
		'2002:7f00:1::1',
		'2001:db8::1',
		'::127.0.0.1',
		'[::1]',
		'not-an-ip',
	])('%s is blocked', (address) => {
		expect(isPublicAddress(address)).toBe(false);
	});

	test.each([
		'8.8.8.8',
		'1.1.1.1',
		'172.32.0.1',
		'100.128.0.1',
		'104.21.60.77',
		'2606:4700::1111',
		'::ffff:8.8.8.8',
	])('%s is allowed', (address) => {
		expect(isPublicAddress(address)).toBe(true);
	});
});

describe('isTrustedProxy', () => {
	test('trusts loopback and Cloudflare edges only', () => {
		expect(isTrustedProxy('127.0.0.1')).toBe(true);
		expect(isTrustedProxy('::ffff:127.0.0.1')).toBe(true);
		expect(isTrustedProxy('::1')).toBe(true);
		expect(isTrustedProxy('172.70.1.2')).toBe(true);
		expect(isTrustedProxy('2606:4700:10::1')).toBe(true);
		expect(isTrustedProxy('8.8.8.8')).toBe(false);
		expect(isTrustedProxy('10.0.0.1')).toBe(false);
	});
});

describe('safeFetch', () => {
	let server: http.Server;
	let port = 0;
	const loopbackOnly = (address: string) => address === '127.0.0.1';

	beforeAll(async () => {
		server = http.createServer((req, res) => {
			if (req.url === '/image') {
				res.writeHead(200, { 'Content-Type': 'image/png' });
				res.end(Buffer.alloc(100, 1));
			} else if (req.url === '/big') {
				res.writeHead(200, { 'Content-Type': 'image/png' });
				res.end(Buffer.alloc(2048, 1));
			} else if (req.url === '/big-chunked') {
				res.writeHead(200, { 'Content-Type': 'image/png', 'Transfer-Encoding': 'chunked' });
				for (let i = 0; i < 4; i++) res.write(Buffer.alloc(1024, 1));
				res.end();
			} else if (req.url === '/redirect-ok') {
				res.writeHead(302, { Location: '/image' });
				res.end();
			} else if (req.url === '/redirect-private') {
				res.writeHead(302, { Location: `http://127.0.0.2:${port}/image` });
				res.end();
			} else if (req.url === '/redirect-localhost') {
				res.writeHead(302, { Location: `http://localhost:${port}/image` });
				res.end();
			} else if (req.url === '/redirect-file') {
				res.writeHead(302, { Location: 'file:///etc/passwd' });
				res.end();
			} else if (req.url === '/loop') {
				res.writeHead(302, { Location: '/loop' });
				res.end();
			} else if (req.url === '/hang') {
				/* Never answer. */
			} else {
				res.writeHead(404);
				res.end();
			}
		});
		await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
		port = (server.address() as { port: number }).port;
	});
	afterAll(() => {
		server.closeAllConnections();
		server.close();
	});

	const reason = async (promise: Promise<unknown>) => {
		try {
			await promise;
		} catch (error) {
			expect(error).toBeInstanceOf(SafeFetchError);
			return (error as SafeFetchError).status;
		}
		throw new Error('Expected the request to be refused');
	};

	test('refuses loopback and metadata addresses with the production rule', async () => {
		expect(await reason(safeFetch(`http://127.0.0.1:${port}/image`))).toBe(400);
		expect(await reason(safeFetch(`http://localhost:${port}/image`))).toBe(400);
		expect(await reason(safeFetch(`http://[::1]:${port}/image`))).toBe(400);
		expect(await reason(safeFetch('http://169.254.169.254/latest/meta-data/'))).toBe(400);
		expect(await reason(safeFetch('http://2130706433/'))).toBe(400);
		expect(await reason(safeFetch('http://0x7f.1/'))).toBe(400);
	});

	test('refuses other schemes', async () => {
		expect(await reason(safeFetch('file:///etc/passwd'))).toBe(400);
		expect(await reason(safeFetch('ftp://example.com/a.png'))).toBe(400);
		expect(await reason(safeFetch('data:image/png;base64,AAAA'))).toBe(400);
	});

	test('fetches an allowed address and follows safe redirects', async () => {
		const direct = await safeFetch(`http://127.0.0.1:${port}/image`, { isAllowedAddress: loopbackOnly });
		expect(direct.ok).toBe(true);
		expect(direct.contentType).toBe('image/png');
		expect(direct.body.length).toBe(100);
		const redirected = await safeFetch(`http://127.0.0.1:${port}/redirect-ok`, { isAllowedAddress: loopbackOnly });
		expect(redirected.body.length).toBe(100);
	});

	test('checks every redirect target', async () => {
		const options = { isAllowedAddress: loopbackOnly };
		expect(await reason(safeFetch(`http://127.0.0.1:${port}/redirect-private`, options))).toBe(400);
		expect(await reason(safeFetch(`http://127.0.0.1:${port}/redirect-file`, options))).toBe(400);
		expect(await reason(safeFetch(`http://127.0.0.1:${port}/loop`, options))).toBe(502);
	});

	test('rejects hostnames that resolve to any disallowed address', async () => {
		const onlyV6Loopback = (address: string) => address === '::2';
		expect(await reason(safeFetch(`http://localhost:${port}/image`, { isAllowedAddress: onlyV6Loopback }))).toBe(400);
	});

	test('enforces the size limit for declared and streamed bodies', async () => {
		const options = { isAllowedAddress: loopbackOnly, maxBytes: 1024 };
		expect(await reason(safeFetch(`http://127.0.0.1:${port}/big`, options))).toBe(413);
		expect(await reason(safeFetch(`http://127.0.0.1:${port}/big-chunked`, options))).toBe(413);
	});

	test('times out', async () => {
		expect(
			await reason(safeFetch(`http://127.0.0.1:${port}/hang`, { isAllowedAddress: loopbackOnly, timeoutMs: 300 })),
		).toBe(504);
	});
});
