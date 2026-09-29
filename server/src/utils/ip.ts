import { isIP } from 'node:net';

// Explicit CIDR matching. Bun's net.BlockList currently reports public addresses as blocked, so it
// cannot be used for either SSRF checks or proxy trust.

function parseIPv4(ip: string): number | null {
	const parts = ip.split('.');
	if (parts.length !== 4) return null;
	let value = 0;
	for (const part of parts) {
		if (!/^\d{1,3}$/.test(part)) return null;
		const octet = Number(part);
		if (octet > 255) return null;
		value = value * 256 + octet;
	}
	return value;
}

function parseIPv6(input: string): bigint | null {
	let ip = input.split('%')[0].toLowerCase();
	// Trailing dotted IPv4 (e.g. ::ffff:127.0.0.1) becomes two hextets.
	const lastColon = ip.lastIndexOf(':');
	if (ip.includes('.', lastColon)) {
		const v4 = parseIPv4(ip.slice(lastColon + 1));
		if (v4 === null) return null;
		ip = `${ip.slice(0, lastColon + 1)}${(v4 >>> 16).toString(16)}:${(v4 & 0xffff).toString(16)}`;
	}
	const halves = ip.split('::');
	if (halves.length > 2) return null;
	const head = halves[0] ? halves[0].split(':') : [];
	const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
	const missing = 8 - head.length - tail.length;
	if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
	const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill('0'), ...tail];
	let value = 0n;
	for (const group of groups) {
		if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
		value = (value << 16n) | BigInt(Number.parseInt(group, 16));
	}
	return value;
}

type V4Range = [number, number];
type V6Range = [bigint, number];

function v4(cidr: string): V4Range {
	const [ip, bits] = cidr.split('/');
	return [parseIPv4(ip)!, Number(bits)];
}

function v6(cidr: string): V6Range {
	const [ip, bits] = cidr.split('/');
	return [parseIPv6(ip)!, Number(bits)];
}

function inV4(ip: number, [base, bits]: V4Range): boolean {
	if (bits === 0) return true;
	const shift = 32 - bits;
	return Math.floor(ip / 2 ** shift) === Math.floor(base / 2 ** shift);
}

function inV6(ip: bigint, [base, bits]: V6Range): boolean {
	const shift = BigInt(128 - bits);
	return ip >> shift === base >> shift;
}

// Not globally routable: "this network", private, CGNAT, loopback, link-local (including the
// 169.254.169.254 metadata address), IETF protocol assignments, documentation, benchmarking,
// 6to4 relay anycast, multicast, reserved, and broadcast.
const BLOCKED_V4 = [
	'0.0.0.0/8',
	'10.0.0.0/8',
	'100.64.0.0/10',
	'127.0.0.0/8',
	'169.254.0.0/16',
	'172.16.0.0/12',
	'192.0.0.0/24',
	'192.0.2.0/24',
	'192.88.99.0/24',
	'192.168.0.0/16',
	'198.18.0.0/15',
	'198.51.100.0/24',
	'203.0.113.0/24',
	'224.0.0.0/4',
	'240.0.0.0/4',
].map(v4);

const GLOBAL_UNICAST_V6 = v6('2000::/3');
const BLOCKED_V6 = ['2001::/32', '2001:db8::/32', '2001:10::/28', '2001:20::/28'].map(v6);
const MAPPED_V4 = v6('::ffff:0:0/96');
const NAT64_V4 = v6('64:ff9b::/96');
const SIX_TO_FOUR = v6('2002::/16');

function isPublicV4(ip: number): boolean {
	return !BLOCKED_V4.some((range) => inV4(ip, range));
}

function isPublicV6(ip: bigint): boolean {
	// Addresses that embed an IPv4 destination are judged by that destination.
	if (inV6(ip, MAPPED_V4) || inV6(ip, NAT64_V4)) return isPublicV4(Number(ip & 0xffffffffn));
	if (inV6(ip, SIX_TO_FOUR)) return isPublicV4(Number((ip >> 80n) & 0xffffffffn));
	// Everything outside global unicast is loopback, unspecified, unique-local, link-local,
	// site-local, multicast, or deprecated IPv4-compatible space.
	return inV6(ip, GLOBAL_UNICAST_V6) && !BLOCKED_V6.some((range) => inV6(ip, range));
}

/** True only for globally routable unicast addresses. Anything unparseable is not public. */
export function isPublicAddress(address: string): boolean {
	const ip = address.replace(/^\[|\]$/g, '');
	const family = isIP(ip.split('%')[0]);
	if (family === 4) return isPublicV4(parseIPv4(ip)!);
	if (family === 6) {
		const value = parseIPv6(ip);
		return value !== null && isPublicV6(value);
	}
	return false;
}

// https://www.cloudflare.com/ips/ (checked 2026-09-29).
const CLOUDFLARE_V4 = [
	'173.245.48.0/20',
	'103.21.244.0/22',
	'103.22.200.0/22',
	'103.31.4.0/22',
	'141.101.64.0/18',
	'108.162.192.0/18',
	'190.93.240.0/20',
	'188.114.96.0/20',
	'197.234.240.0/22',
	'198.41.128.0/17',
	'162.158.0.0/15',
	'104.16.0.0/13',
	'104.24.0.0/14',
	'172.64.0.0/13',
	'131.0.72.0/22',
].map(v4);

const CLOUDFLARE_V6 = [
	'2400:cb00::/32',
	'2606:4700::/32',
	'2803:f800::/32',
	'2405:b500::/32',
	'2405:8100::/32',
	'2a06:98c0::/29',
	'2c0f:f248::/32',
].map(v6);

function toV4(address: string): number | null {
	if (isIP(address) === 4) return parseIPv4(address);
	const value = isIP(address) === 6 ? parseIPv6(address) : null;
	return value !== null && inV6(value, MAPPED_V4) ? Number(value & 0xffffffffn) : null;
}

/**
 * Hops whose X-Forwarded-For entries we believe: the local nginx and Cloudflare's edge. A request
 * that reaches nginx directly (bypassing Cloudflare) is attributed to its real peer address, so a
 * forged X-Forwarded-For or CF-Connecting-IP cannot choose the rate-limit key.
 */
export function isTrustedProxy(address: string): boolean {
	const ip4 = toV4(address);
	if (ip4 !== null) return inV4(ip4, v4('127.0.0.0/8')) || CLOUDFLARE_V4.some((range) => inV4(ip4, range));
	const ip6 = isIP(address) === 6 ? parseIPv6(address) : null;
	return ip6 !== null && (ip6 === 1n || CLOUDFLARE_V6.some((range) => inV6(ip6, range)));
}
