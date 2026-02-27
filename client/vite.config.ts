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
			registerType: 'prompt',
			strategies: 'injectManifest',
			srcDir: 'src',
			filename: 'sw.ts',
			injectManifest: {
				globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
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
