import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
	testDir: './e2e',
	testMatch: '**/*.spec.ts',
	fullyParallel: false,
	workers: 1,
	timeout: 30000,
	reporter: 'list',
	use: { baseURL: 'http://127.0.0.1:5179', trace: 'retain-on-failure' },
	projects: [
		{ name: 'chromium', use: { ...devices['Desktop Chrome'] } },
		{ name: 'webkit-ipad', use: { ...devices['iPad Pro 11'] } },
	],
	webServer: [
		{ command: 'bun e2e/server.ts', url: 'http://127.0.0.1:5188', reuseExistingServer: false },
		{
			command: 'bunx vite preview --outDir dist-e2e --host 127.0.0.1 --port 5179 --strictPort',
			cwd: './client',
			url: 'http://127.0.0.1:5179',
			reuseExistingServer: false,
		},
	],
});
