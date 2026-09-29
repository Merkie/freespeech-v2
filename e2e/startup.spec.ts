import { expect, type Page, test } from '@playwright/test';
import { account, board, controls } from './fixtures';

async function seed(
	page: Page,
	options: { draft?: boolean; controls?: boolean; scroll?: boolean; blocked?: boolean } = {},
) {
	await page.goto('/');
	await page.evaluate(
		async ({ board, account, controls, options }) => {
			const token = `header.${btoa(JSON.stringify({ id: account.id, blocked: options.blocked }))}.signature`;
			localStorage.setItem('token', token);
			localStorage.setItem(
				'localSettings',
				JSON.stringify({ lastVisitedProjectId: board.id, lastVisitedPageId: 'page-9', speakOnTap: false }),
			);
			localStorage.setItem(
				'freespeech-resume',
				JSON.stringify({
					projectId: board.id,
					pageId: 'page-9',
					sentence: [{ x: 0, y: 0, page: 0, text: 'Hello', image: '', navigation: '', displayText: '' }],
					scroll: options.scroll ? 1 : 0,
				}),
			);
			const db = await new Promise<IDBDatabase>((resolve, reject) => {
				const req = indexedDB.open('freespeech-cache', 4);
				req.onupgradeneeded = () => {
					for (const name of ['meta', 'projectBlobs'])
						if (!req.result.objectStoreNames.contains(name))
							req.result.createObjectStore(name, { keyPath: name === 'meta' ? 'key' : 'id' });
				};
				req.onsuccess = () => resolve(req.result);
				req.onerror = () => reject(req.error);
			});
			const tx = db.transaction(['meta', 'projectBlobs'], 'readwrite');
			const meta = tx.objectStore('meta');
			meta.put({ key: 'authToken', value: token });
			meta.put({ key: 'authUser', value: JSON.stringify(account) });
			if (options.controls !== false)
				meta.put({ key: `accessControls:${account.id}`, value: JSON.stringify(controls) });
			if (options.scroll)
				board.pages[9].tiles.push({ x: 0, y: 0, page: 1, text: 'Second subpage', image: '', navigation: '' });
			const draft = structuredClone(board);
			draft.pages[9].tiles[0].text = 'Recovered tile';
			tx.objectStore('projectBlobs').put({
				id: board.id,
				blob: board,
				dirty: false,
				revision: 0,
				cachedAt: Date.now(),
				etag: 'W/"fixture"',
				...(options.draft ? { draft } : {}),
			});
			await new Promise<void>((resolve, reject) => {
				tx.oncomplete = () => resolve();
				tx.onerror = () => reject(tx.error);
			});
			db.close();
		},
		{ board, account, controls, options },
	);
	// Model a returning installed app: its first service-worker installation has completed.
	await page.evaluate(async () => {
		await navigator.serviceWorker.ready;
	});
	await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.state)).toBe('activated');
}

test('saved board and sentence render while all API responses are held', async ({ page }) => {
	await seed(page, { blocked: true });
	const start = Date.now();
	await page.goto('/app');
	await expect(page.getByText('Tile 9', { exact: true })).toBeVisible({ timeout: 1800 });
	await expect(page.getByText('Hello', { exact: true })).toBeVisible();
	console.log(`Cached board visible with API held: ${Date.now() - start} ms`);
});

test('unknown access controls never enable editing during a cached launch', async ({ page }) => {
	await seed(page, { controls: false, blocked: true });
	await page.goto('/app');
	await expect(page.getByText('Tile 9', { exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Edit tiles' })).toBeDisabled();
});

test('an old deep link loads its requested page instead of Home or the last page', async ({ page }) => {
	await seed(page);
	await page.goto('/app/project/fixture-board/page-42');
	await expect(page.getByText('Tile 42', { exact: true })).toBeVisible();
});

test('draft recovery waits for editor entry and Discard survives another restart', async ({ page }) => {
	await seed(page, { draft: true });
	await page.goto('/app');
	await expect(page.getByText('Tile 9', { exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Edit tiles' }).click();
	await expect(page.getByText('Recovered tile', { exact: true })).toBeVisible();
	await expect(page.getByText('Recovered draft', { exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Edit tiles' }).click();
	await page.getByRole('button', { name: 'Discard Changes' }).click();
	await expect(page.getByText('Tile 9', { exact: true })).toBeVisible();
	await page.reload();
	await page.getByRole('button', { name: 'Edit tiles' }).click();
	await expect(page.getByText('Tile 9', { exact: true })).toBeVisible();
	await expect(page.getByText('Recovered draft', { exact: true })).toHaveCount(0);
});

test('installed shell opens cold offline with all 230 images, including unseen pages', async ({
	page,
	context,
	browserName,
}) => {
	test.skip(
		browserName !== 'chromium',
		'Playwright only supports service-worker offline emulation in Chromium; verify cold installed launch on the physical iPad.',
	);
	await seed(page);
	await page.goto('/app');
	await expect(page.getByText('Images saved', { exact: true })).toBeVisible({ timeout: 20000 });
	await page.evaluate(async () => {
		await navigator.serviceWorker.ready;
	});
	await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
	expect(
		await page.evaluate(async () => (await (await caches.open('freespeech-board-images-fixture-board')).keys()).length),
	).toBe(230);
	await page.close();
	await context.setOffline(true);
	const cold = await context.newPage();
	await cold.goto('/app');
	await expect(cold.getByText('Tile 9', { exact: true })).toBeVisible();
	await cold.goto('/app/project/fixture-board/page-229');
	await expect(cold.getByText('Tile 229', { exact: true })).toBeVisible();
	await expect
		.poll(() =>
			cold
				.locator('img[src$="/images/229.png"]')
				.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0),
		)
		.toBe(true);
});

test('any page can be set as Home and the selection survives Save', async ({ page }) => {
	await seed(page);
	await page.goto('/app');
	await page.getByRole('button', { name: 'Edit tiles' }).click();
	await page.getByRole('button', { name: 'Page Actions' }).click();
	await page.getByRole('button', { name: 'Manage Pages' }).click();
	const row = page
		.locator('div.flex.items-center.gap-3.py-3')
		.filter({ has: page.getByText('Page 9', { exact: true }) });
	await row.getByRole('button', { name: 'Set as Home', exact: true }).click();
	await page.getByRole('button', { name: 'Close', exact: true }).click();
	await page.getByRole('button', { name: 'Edit tiles' }).click();
	await page.getByRole('button', { name: /Save Changes$/ }).click();
	await page.getByRole('link', { name: 'Home', exact: true }).click();
	await expect(page.getByText('Tile 9', { exact: true })).toBeVisible();
	expect(
		await page.evaluate(async () => {
			const db = await new Promise<IDBDatabase>((resolve) => {
				const req = indexedDB.open('freespeech-cache');
				req.onsuccess = () => resolve(req.result);
			});
			return new Promise<string>((resolve) => {
				const req = db.transaction('projectBlobs').objectStore('projectBlobs').get('fixture-board');
				req.onsuccess = () => {
					resolve(req.result.blob.homePageId);
					db.close();
				};
			});
		}),
	).toBe('page-9');
});

test('a storage quota failure keeps online images usable and reports incomplete downloads', async ({ page }) => {
	await seed(page);
	await page.addInitScript(() => {
		const original = Cache.prototype.put;
		Cache.prototype.put = async function (request, response) {
			const url = typeof request === 'string' ? request : request instanceof URL ? request.href : request.url;
			if (url.includes('/images/')) throw new DOMException('Test quota', 'QuotaExceededError');
			return original.call(this, request, response);
		};
	});
	await page.goto('/app');
	await expect(page.getByText('Offline images 0/230', { exact: true })).toBeVisible({ timeout: 20000 });
	await expect
		.poll(() =>
			page.locator('img[src$="/images/9.png"]').evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0),
		)
		.toBe(true);
	await expect(page.getByText('Images saved', { exact: true })).toHaveCount(0);
});

test('a previous release’s deferred chunk remains available under the updated worker', async ({
	page,
	browserName,
}) => {
	test.skip(browserName !== 'chromium', 'Service-worker emulation is Chromium-only.');
	await seed(page);
	await page.goto('/app');
	await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
	const content = await page.evaluate(async () => {
		const cache = await caches.open('freespeech-static-previous-release');
		await cache.put(
			'/assets/previous-editor.js',
			new Response('export default "previous editor"', { headers: { 'Content-Type': 'application/javascript' } }),
		);
		return (await fetch('/assets/previous-editor.js')).text();
	});
	expect(content).toBe('export default "previous editor"');
});

test('cold launch restores the scroll position within the last page', async ({ page }) => {
	await seed(page, { scroll: true });
	await page.goto('/app');
	await expect
		.poll(() => page.locator('[data-board-scroll]').evaluate((el) => el.scrollTop / el.clientHeight))
		.toBeCloseTo(1, 1);
	await page.reload();
	await expect
		.poll(() => page.locator('[data-board-scroll]').evaluate((el) => el.scrollTop / el.clientHeight))
		.toBeCloseTo(1, 1);
});

test('normal navigation becomes the next cold-launch page', async ({ page }) => {
	await seed(page);
	await page.goto('/app');
	await page.getByText('Next page', { exact: true }).click();
	await expect(page.getByText('Tile 10', { exact: true })).toBeVisible();
	await page.reload();
	await expect(page.getByText('Tile 10', { exact: true })).toBeVisible();
});

test('the rate-limit message is shown on sign-in', async ({ page }) => {
	await page.goto('/login/email?email=limited@example.invalid');
	await page.getByPlaceholder('Your password').fill('whatever');
	await page.getByRole('button', { name: 'Continue' }).click();
	await expect(page.getByText('Too many attempts. Please wait 15 minutes and try again.')).toBeVisible();
});

test('account data downloads as JSON', async ({ page }) => {
	await seed(page);
	await page.goto('/app/dashboard/profile');
	const download = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Download my data' }).click();
	expect((await download).suggestedFilename()).toMatch(/^freespeech-data-\d{4}-\d{2}-\d{2}\.json$/);
});

test('deleting the account signs out and removes its data from the device', async ({ page }) => {
	await seed(page);
	await page.goto('/app');
	await expect(page.getByText('Tile 9', { exact: true })).toBeVisible();
	await page.goto('/app/dashboard/profile');
	await page.getByRole('button', { name: 'Delete account' }).click();
	await page.getByLabel(`Type ${account.email} to confirm`).fill('someone@else.invalid');
	await page.getByRole('button', { name: 'Delete permanently' }).click();
	await expect(page.getByText('That email does not match this account.')).toBeVisible();
	await page.getByLabel(`Type ${account.email} to confirm`).fill(account.email);
	await page.getByRole('button', { name: 'Delete permanently' }).click();
	await expect(page).toHaveURL(/\/$/);
	const left = await page.evaluate(async () => {
		const db = await new Promise<IDBDatabase>((resolve, reject) => {
			const req = indexedDB.open('freespeech-cache', 4);
			req.onsuccess = () => resolve(req.result);
			req.onerror = () => reject(req.error);
		});
		const count = (store: string) =>
			new Promise<number>((resolve) => {
				const req = db.transaction(store).objectStore(store).count();
				req.onsuccess = () => resolve(req.result);
			});
		const result = {
			boards: await count('projectBlobs'),
			meta: await count('meta'),
			token: localStorage.getItem('token'),
			resume: localStorage.getItem('freespeech-resume'),
			imageCaches: (await caches.keys()).filter((key) => key.startsWith('freespeech-board-images-')).length,
		};
		db.close();
		return result;
	});
	expect(left).toEqual({ boards: 0, meta: 0, token: null, resume: null, imageCaches: 0 });
});
