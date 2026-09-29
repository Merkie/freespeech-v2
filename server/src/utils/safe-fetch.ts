import dns from 'node:dns';
import { isIP } from 'node:net';
import { isPublicAddress } from '@/utils/ip';

/**
 * Server-side fetch for URLs supplied by users (image search results, pasted links, imported
 * boards). Only http/https to globally routable addresses is allowed. Every hostname is resolved
 * here, all of its addresses are checked, and the request is sent to the checked address with the
 * original Host and TLS server name, so a second DNS answer cannot redirect it (DNS rebinding).
 * Redirects are followed manually and each Location is checked the same way.
 *
 * This deliberately uses fetch with a pinned address rather than node:http's `lookup` option:
 * Bun 1.3.10 (production) drops the TLS server name when `lookup` is set and then emits a second,
 * unhandled error that terminates the process.
 */

export class SafeFetchError extends Error {
	constructor(
		message: string,
		readonly status: number,
	) {
		super(message);
		this.name = 'SafeFetchError';
	}
}

export type SafeFetchOptions = {
	timeoutMs?: number;
	maxBytes?: number;
	maxRedirects?: number;
	headers?: Record<string, string>;
	/** Test hook. Production callers always use the public-address rule. */
	isAllowedAddress?: (address: string) => boolean;
};

export type SafeFetchResponse = {
	ok: boolean;
	status: number;
	statusText: string;
	url: string;
	contentType: string;
	body: Buffer;
};

export const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 10_000;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const NOT_ALLOWED = 'That address is not allowed';

function parseAllowedUrl(raw: string): URL {
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		throw new SafeFetchError('Invalid URL', 400);
	}
	if (url.protocol !== 'http:' && url.protocol !== 'https:')
		throw new SafeFetchError('Only HTTP and HTTPS URLs are allowed', 400);
	if (!url.hostname) throw new SafeFetchError('Invalid URL', 400);
	return url;
}

/** Resolves the host and returns one checked address to connect to. */
async function checkedAddress(hostname: string, isAllowed: (address: string) => boolean): Promise<string> {
	if (isIP(hostname)) {
		if (!isAllowed(hostname)) throw new SafeFetchError(NOT_ALLOWED, 400);
		return hostname;
	}
	let addresses: dns.LookupAddress[];
	try {
		addresses = await dns.promises.lookup(hostname, { all: true });
	} catch {
		throw new SafeFetchError('Could not resolve that host', 502);
	}
	// Reject when any answer is private: a round-robin record must not smuggle one in.
	if (!addresses.length || addresses.some((entry) => !isAllowed(entry.address)))
		throw new SafeFetchError(NOT_ALLOWED, 400);
	// The production host has no global IPv6 route, so prefer IPv4.
	return (addresses.find((entry) => entry.family === 4) ?? addresses[0]).address;
}

async function readLimited(response: Response, maxBytes: number): Promise<Buffer> {
	const declared = Number(response.headers.get('content-length'));
	if (Number.isFinite(declared) && declared > maxBytes) {
		await response.body?.cancel().catch(() => undefined);
		throw new SafeFetchError('The file is too large', 413);
	}
	if (!response.body) return Buffer.alloc(0);
	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		size += value.byteLength;
		if (size > maxBytes) {
			await reader.cancel().catch(() => undefined);
			throw new SafeFetchError('The file is too large', 413);
		}
		chunks.push(value);
	}
	return Buffer.concat(chunks);
}

export async function safeFetch(rawUrl: string, options: SafeFetchOptions = {}): Promise<SafeFetchResponse> {
	const isAllowed = options.isAllowedAddress ?? isPublicAddress;
	const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
	const maxRedirects = options.maxRedirects ?? 5;
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

	try {
		let url = parseAllowedUrl(rawUrl);
		for (let hop = 0; ; hop++) {
			const hostname = url.hostname.replace(/^\[|\]$/g, '');
			const address = await checkedAddress(hostname, isAllowed);
			const target = new URL(url);
			target.hostname = isIP(address) === 6 ? `[${address}]` : address;

			const response = await fetch(target, {
				redirect: 'manual',
				signal: controller.signal,
				headers: {
					'User-Agent': 'FreeSpeech/2.0 (+https://freespeechaac.com)',
					Accept: 'image/*,*/*;q=0.8',
					...options.headers,
					Host: url.host,
				},
				// Certificate checks still apply, against the original host name.
				tls: { serverName: hostname },
			} as RequestInit);

			const location = response.headers.get('location');
			if (REDIRECT_STATUSES.has(response.status) && location) {
				await response.body?.cancel().catch(() => undefined);
				if (hop >= maxRedirects) throw new SafeFetchError('Too many redirects', 502);
				url = parseAllowedUrl(new URL(location, url).toString());
				continue;
			}

			const body = await readLimited(response, maxBytes);
			return {
				ok: response.ok,
				status: response.status,
				statusText: response.statusText,
				url: url.toString(),
				contentType: response.headers.get('content-type') ?? '',
				body,
			};
		}
	} catch (error) {
		if (error instanceof SafeFetchError) throw error;
		if (controller.signal.aborted) throw new SafeFetchError('The request timed out', 504);
		throw new SafeFetchError('Could not fetch that URL', 502);
	} finally {
		clearTimeout(timer);
	}
}

/** Resolves a user-supplied hostname and reports whether every address is public. */
export async function isPublicHost(hostname: string): Promise<boolean> {
	const host = hostname.replace(/^\[|\]$/g, '');
	if (isIP(host)) return isPublicAddress(host);
	try {
		const addresses = await dns.promises.lookup(host, { all: true });
		return addresses.length > 0 && addresses.every((entry) => isPublicAddress(entry.address));
	} catch {
		return false;
	}
}
