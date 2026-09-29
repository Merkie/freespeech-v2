import { account, board, controls } from './fixtures';

const png = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF+0AAAAASUVORK5CYII=',
	'base64',
);
Bun.serve({
	hostname: '127.0.0.1',
	port: 5188,
	async fetch(req) {
		const url = new URL(req.url);
		const headers = {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Headers': '*',
			'Access-Control-Allow-Methods': 'GET,POST,OPTIONS,DELETE',
			'Access-Control-Expose-Headers': 'ETag',
		};
		if (req.method === 'OPTIONS') return new Response(null, { headers });
		if (url.pathname.startsWith('/images/'))
			return new Response(png, { headers: { ...headers, 'Content-Type': 'image/png' } });
		const token = req.headers.get('authorization')?.split(' ')[1];
		const blocked = token && JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).blocked;
		// Delay at the server so this also covers WebKit requests made through a worker.
		if (blocked) await new Promise((resolve) => setTimeout(resolve, 30000));
		if (url.pathname.endsWith('/blob')) {
			if (req.headers.get('if-none-match') === 'W/"fixture"') return new Response(null, { status: 304, headers });
			return Response.json({ blob: board }, { headers: { ...headers, ETag: 'W/"fixture"' } });
		}
		if (url.pathname.endsWith('/me')) return Response.json({ user: account }, { headers });
		if (url.pathname.endsWith('/access-controls')) return Response.json({ settings: controls }, { headers });
		if (url.pathname.endsWith('/sync'))
			return Response.json({ success: true, lastEditedAt: new Date().toISOString() }, { headers });
		if (url.pathname.endsWith('/list')) return Response.json({ projects: [board] }, { headers });
		return Response.json({}, { headers });
	},
});
