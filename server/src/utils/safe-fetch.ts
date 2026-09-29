import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import { isIP } from 'node:net';
import type { Readable } from 'node:stream';
import zlib from 'node:zlib';
import { isPublicAddress } from '@/utils/ip';

/**
 * Server-side fetch for URLs supplied by users (image search results, pasted links, imported
 * boards). Only http/https to globally routable addresses is allowed. The address check runs in
 * the socket's DNS lookup, so it covers the address actually connected to on every hop, and
 * redirects are followed manually so each Location is checked again.
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

type Lookup = NonNullable<http.RequestOptions['lookup']>;

function checkedLookup(isAllowed: (address: string) => boolean): Lookup {
	return ((hostname: string, options: dns.LookupOptions, callback: (...args: unknown[]) => void) => {
		const family = typeof options?.family === 'number' ? options.family : 0;
		dns.lookup(hostname, { all: true, family }, (error, addresses) => {
			if (error) return callback(error);
			const list = addresses as dns.LookupAddress[];
			// Reject when any answer is private: a round-robin record must not smuggle one in.
			if (!list.length || list.some((entry) => !isAllowed(entry.address)))
				return callback(new SafeFetchError('That address is not allowed', 400));
			if (options?.all) callback(null, list);
			else callback(null, list[0].address, list[0].family);
		});
	}) as Lookup;
}

function parseAllowedUrl(raw: string, isAllowed: (address: string) => boolean): URL {
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		throw new SafeFetchError('Invalid URL', 400);
	}
	if (url.protocol !== 'http:' && url.protocol !== 'https:')
		throw new SafeFetchError('Only HTTP and HTTPS URLs are allowed', 400);
	const host = url.hostname.replace(/^\[|\]$/g, '');
	// IP literals never reach the lookup function.
	if (isIP(host) && !isAllowed(host)) throw new SafeFetchError('That address is not allowed', 400);
	if (!host) throw new SafeFetchError('Invalid URL', 400);
	return url;
}

function decode(response: http.IncomingMessage): Readable {
	switch ((response.headers['content-encoding'] ?? '').toLowerCase()) {
		case 'gzip':
		case 'x-gzip':
			return response.pipe(zlib.createGunzip());
		case 'deflate':
			return response.pipe(zlib.createInflate());
		case 'br':
			return response.pipe(zlib.createBrotliDecompress());
		default:
			return response;
	}
}

export async function safeFetch(rawUrl: string, options: SafeFetchOptions = {}): Promise<SafeFetchResponse> {
	const isAllowed = options.isAllowedAddress ?? isPublicAddress;
	const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
	const maxRedirects = options.maxRedirects ?? 5;
	const lookup = checkedLookup(isAllowed);
	let current: http.ClientRequest | null = null;
	let body: Readable | null = null;
	let timer: ReturnType<typeof setTimeout> | undefined;
	// Bun does not report destroying a pending request as an error, so every wait races this.
	const deadline = new Promise<never>((_, reject) => {
		timer = setTimeout(() => {
			reject(new SafeFetchError('The request timed out', 504));
			current?.destroy();
			body?.destroy();
		}, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
	});
	deadline.catch(() => undefined);

	try {
		let url = parseAllowedUrl(rawUrl, isAllowed);
		for (let hop = 0; ; hop++) {
			const request = new Promise<http.IncomingMessage>((resolve, reject) => {
				const client = url.protocol === 'https:' ? https : http;
				current = client.request(url, {
					method: 'GET',
					agent: false,
					lookup,
					headers: {
						'User-Agent': 'FreeSpeech/2.0 (+https://freespeechaac.com)',
						Accept: 'image/*,*/*;q=0.8',
						'Accept-Encoding': 'gzip, deflate, br',
						...options.headers,
					},
				});
				current.once('response', resolve);
				current.once('error', reject);
				current.end();
			});
			const response = await Promise.race([request, deadline]);

			const status = response.statusCode ?? 0;
			const location = response.headers.location;
			if (REDIRECT_STATUSES.has(status) && location) {
				response.resume();
				if (hop >= maxRedirects) throw new SafeFetchError('Too many redirects', 502);
				url = parseAllowedUrl(new URL(location, url).toString(), isAllowed);
				continue;
			}

			const declared = Number(response.headers['content-length']);
			if (Number.isFinite(declared) && declared > maxBytes) {
				response.destroy();
				throw new SafeFetchError('The file is too large', 413);
			}

			const chunks: Buffer[] = [];
			let size = 0;
			const stream = decode(response);
			body = stream;
			const read = new Promise<void>((resolve, reject) => {
				stream.on('data', (chunk: Buffer) => {
					size += chunk.length;
					if (size > maxBytes) {
						reject(new SafeFetchError('The file is too large', 413));
						response.destroy();
						stream.destroy();
						return;
					}
					chunks.push(chunk);
				});
				stream.once('end', resolve);
				stream.once('error', reject);
				response.once('error', reject);
				response.once('aborted', () => reject(new SafeFetchError('The response was interrupted', 502)));
			});
			await Promise.race([read, deadline]);

			return {
				ok: status >= 200 && status < 300,
				status,
				statusText: response.statusMessage ?? '',
				url: url.toString(),
				contentType: String(response.headers['content-type'] ?? ''),
				body: Buffer.concat(chunks),
			};
		}
	} catch (error) {
		(current as http.ClientRequest | null)?.destroy();
		if (error instanceof SafeFetchError) throw error;
		// Bun may wrap the lookup's error; keep its status when the message survives.
		if (error instanceof Error && error.message === 'That address is not allowed')
			throw new SafeFetchError(error.message, 400);
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
