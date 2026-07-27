import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import solid from 'vite-plugin-solid';

export default defineConfig({
	define: {
		__APP_VERSION__: JSON.stringify(process.env.APP_VERSION || '1.0.0'),
	},
	plugins: [
		solid(),
		tailwindcss(),
		VitePWA({
			// 'prompt' parks a new worker in "waiting" until every client closes, and nothing in the
			// app posts SKIP_WAITING. An installed iOS PWA is effectively never closed, so a device
			// that picked up a broken worker would keep it — including through a fix for that worker.
			registerType: 'autoUpdate',
			strategies: 'injectManifest',
			srcDir: 'src',
			filename: 'sw.ts',
			injectManifest: {
				// manifest.json is included so an offline launch can still read the PWA manifest.
				// The landing page's parallax hero images are deliberately left out: they are
				// ~900 KB of marketing art, and an installed app starts at /app, never at /.
				globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,json}'],
			},
			manifest: false, // We use our own manifest.json in public/
			devOptions: {
				enabled: true,
				type: 'module',
			},
		}),
	],
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src'),
		},
	},
});
