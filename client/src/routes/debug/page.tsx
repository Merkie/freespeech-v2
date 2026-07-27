import { type Component, createSignal, For, onMount } from 'solid-js';
import { getCachedBlob } from '@/lib/cache/blob-cache';
import { CLIENT_VERSION } from '@/lib/version-check';

/**
 * On-device diagnostics for the "images don't load on this one device" class of bug, which cannot
 * be reproduced from the outside: it has been device-specific (an installed PWA and Safari on the
 * same iPad both failing while an iPhone on the same build is fine), so the only useful instrument
 * is the failing device itself. Open v2.freespeechaac.com/debug on it and copy the report.
 *
 * Each probe image is loaded twice — once normally and once with ?sw-bypass, which the service
 * worker deliberately ignores — so a failure separates cleanly into "the worker broke it"
 * (normal fails, bypass loads) versus "the device or network broke it" (both fail).
 */

// One representative image per host that boards actually reference, verified reachable from the
// server. The first is same-origin and precached, so it should be unbreakable — if even it fails,
// the problem is in front of the app, not in it.
const IMAGE_PROBES = [
	{ label: 'app icon (same origin)', url: '/icons/icon-192x192.png' },
	{
		label: 'media.freespeechaac.com',
		url: 'https://media.freespeechaac.com/della-clhxygrg40000i908qojkj857/1695503727336-screenshot-20230923-at-41354-pmpng',
	},
	{
		label: 's3.amazonaws.com (opensymbols)',
		url: 'https://s3.amazonaws.com/opensymbols/libraries/arasaac/April.png',
	},
	{
		label: 'coughdrop-usercontent',
		url: 'https://coughdrop-usercontent.s3.amazonaws.com/images/1/1/2/8/6/1_11286_95fbf4aa03f23d8d65873f45-a98938040d2adef6b008fafe2904abd5280f88d5982ca4ecf7f8230de1975c2de635f4f781417c0f82801f33dd0007e6302f09260ade05572521a21c4a3be8f4.png',
	},
];

const TIMEOUT_MS = 15000;

interface ProbeResult {
	label: string;
	url: string;
	img: string;
	imgBypass: string;
	fetchNoCors: string;
}

interface LayoutProbeResult {
	label: string;
	outerRect: string;
	buttonRect: string;
	mediaRect: string;
	imageRect: string;
	imageState: string;
	computed: string;
}

function loadImage(src: string): Promise<string> {
	return new Promise((resolve) => {
		const img = new Image();
		const timer = setTimeout(() => resolve(`timeout after ${TIMEOUT_MS}ms`), TIMEOUT_MS);
		img.onload = () => {
			clearTimeout(timer);
			resolve(`ok ${img.naturalWidth}x${img.naturalHeight}`);
		};
		img.onerror = () => {
			clearTimeout(timer);
			resolve('error');
		};
		img.src = src;
	});
}

async function probeFetch(url: string): Promise<string> {
	try {
		const response = await fetch(url, { mode: 'no-cors', signal: AbortSignal.timeout(TIMEOUT_MS) });
		return `ok type=${response.type} status=${response.status}`;
	} catch (error) {
		return `threw ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`;
	}
}

function withBypass(url: string): string {
	return `${url}${url.includes('?') ? '&' : '?'}sw-bypass=1`;
}

function formatRect(element: Element): string {
	const rect = element.getBoundingClientRect();
	const round = (value: number) => Math.round(value * 10) / 10;
	return `${round(rect.width)}x${round(rect.height)} at ${round(rect.left)},${round(rect.top)}`;
}

function afterPaint(): Promise<void> {
	return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

async function collectBoardImageProbes(): Promise<Array<{ label: string; url: string }>> {
	try {
		const stored = JSON.parse(localStorage.getItem('localSettings') ?? '{}') as { lastVisitedProjectId?: string };
		if (!stored.lastVisitedProjectId) return [];

		const blob = await getCachedBlob(stored.lastVisitedProjectId);
		if (!blob) return [];

		const unique = [
			...new Set(
				blob.pages.flatMap((page) => page.tiles.map((tile) => tile.image).filter((url): url is string => !!url)),
			),
		];
		return unique.slice(0, 10).map((url, index) => ({ label: `actual board tile ${index + 1}`, url }));
	} catch {
		return [];
	}
}

async function collectEnvironment(): Promise<Record<string, string>> {
	const env: Record<string, string> = {
		userAgent: navigator.userAgent,
		standalone: String(window.matchMedia('(display-mode: standalone)').matches),
		online: String(navigator.onLine),
		appVersion: CLIENT_VERSION,
		viewport: `${window.innerWidth}x${window.innerHeight}`,
		visualViewport: window.visualViewport
			? `${Math.round(window.visualViewport.width)}x${Math.round(window.visualViewport.height)} scale=${window.visualViewport.scale}`
			: 'unavailable',
		screen: `${screen.width}x${screen.height} @${window.devicePixelRatio}x`,
	};

	// Only include display choices relevant to layout. The same localSettings object also contains
	// the edit-lock hash and salt, which must never leave the device in a diagnostic report.
	try {
		const stored = JSON.parse(localStorage.getItem('localSettings') ?? '{}') as Record<string, unknown>;
		env.tileSettings = JSON.stringify({
			tileTextSize: stored.tileTextSize,
			tileTextOverflow: stored.tileTextOverflow,
			tileImageFit: stored.tileImageFit,
			sentenceBuilder: stored.sentenceBuilder,
		});
	} catch {
		env.tileSettings = 'invalid localStorage JSON';
	}

	try {
		env.swController = navigator.serviceWorker?.controller?.scriptURL ?? 'none';
		const registration = await navigator.serviceWorker?.getRegistration();
		env.swState = registration?.active?.state ?? 'no registration';
		env.swWaiting = String(!!registration?.waiting);
	} catch (error) {
		env.swController = `threw ${String(error)}`;
	}

	// Cache Storage health is a first-class question here: on a device with a full or corrupted
	// store these calls reject, which is precisely the state that can break image loads.
	try {
		env.cacheNames = (await caches.keys()).join(', ') || '(none)';
	} catch (error) {
		env.cacheNames = `threw ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`;
	}
	try {
		const cache = await caches.open('freespeech-images-v2');
		env.imageCacheEntries = String((await cache.keys()).length);
	} catch (error) {
		env.imageCacheEntries = `threw ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`;
	}
	try {
		const estimate = await navigator.storage?.estimate();
		const mb = (n?: number) => `${Math.round((n ?? 0) / 1048576)}MB`;
		env.storage = estimate ? `${mb(estimate.usage)} used of ${mb(estimate.quota)} quota` : 'unavailable';
	} catch (error) {
		env.storage = `threw ${String(error)}`;
	}

	try {
		const response = await fetch(`${import.meta.env.VITE_API_URL}/health?sw-bypass=1`, {
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});
		env.apiHealth = `status ${response.status}`;
	} catch (error) {
		env.apiHealth = `threw ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`;
	}

	return env;
}

const DebugPage: Component = () => {
	const [environment, setEnvironment] = createSignal<Record<string, string>>({});
	const [probes, setProbes] = createSignal<ProbeResult[]>([]);
	const [layoutProbes, setLayoutProbes] = createSignal<LayoutProbeResult[]>([]);
	const [done, setDone] = createSignal(false);
	const [copied, setCopied] = createSignal(false);
	const [uploadState, setUploadState] = createSignal('waiting for probes…');
	let currentOuter!: HTMLDivElement;
	let currentButton!: HTMLButtonElement;
	let currentImage!: HTMLImageElement;
	let legacyOuter!: HTMLDivElement;
	let legacyButton!: HTMLButtonElement;
	let legacyMedia!: HTMLDivElement;
	let legacyImage!: HTMLImageElement;

	const measureLayout = (
		label: string,
		outer: HTMLElement,
		button: HTMLButtonElement,
		media: HTMLElement,
		img: HTMLImageElement,
	): LayoutProbeResult => {
		const imageStyle = getComputedStyle(img);
		const buttonStyle = getComputedStyle(button);
		return {
			label,
			outerRect: formatRect(outer),
			buttonRect: formatRect(button),
			mediaRect: formatRect(media),
			imageRect: formatRect(img),
			imageState: `complete=${img.complete} natural=${img.naturalWidth}x${img.naturalHeight}`,
			computed: `display=${imageStyle.display} position=${imageStyle.position} objectFit=${imageStyle.objectFit} opacity=${imageStyle.opacity} visibility=${imageStyle.visibility} buttonFilter=${buttonStyle.filter}`,
		};
	};

	// Getting the report OFF the failing device is the hard part — copying JSON out of a
	// misbehaving iPad is its own failure mode — so it uploads itself when the probes finish.
	const uploadReport = async () => {
		setUploadState('uploading…');
		try {
			const response = await fetch(`${import.meta.env.VITE_API_URL}/debug-report?sw-bypass=1`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ environment: environment(), probes: probes(), layoutProbes: layoutProbes() }),
				signal: AbortSignal.timeout(TIMEOUT_MS),
			});
			setUploadState(response.ok ? 'sent ✓ — the server has a copy' : `failed (status ${response.status})`);
		} catch (error) {
			setUploadState(`failed (${error instanceof Error ? error.message : String(error)}) — use Copy report instead`);
		}
	};

	onMount(async () => {
		setEnvironment(await collectEnvironment());
		const allImageProbes = [...IMAGE_PROBES, ...(await collectBoardImageProbes())];
		for (const probe of allImageProbes) {
			const [img, imgBypass, fetchNoCors] = await Promise.all([
				loadImage(probe.url),
				loadImage(withBypass(probe.url)),
				probeFetch(probe.url),
			]);
			setProbes((prev) => [...prev, { label: probe.label, url: probe.url, img, imgBypass, fetchNoCors }]);
		}

		await afterPaint();
		setLayoutProbes([
			measureLayout('current grid layout', currentOuter, currentButton, currentImage, currentImage),
			measureLayout('legacy flex/absolute/filter layout', legacyOuter, legacyButton, legacyMedia, legacyImage),
		]);
		setDone(true);
		await uploadReport();
	});

	const report = () =>
		JSON.stringify({ environment: environment(), probes: probes(), layoutProbes: layoutProbes() }, null, 2);

	const copyReport = async () => {
		try {
			await navigator.clipboard.writeText(report());
			setCopied(true);
		} catch {
			// The <pre> below is always there to copy by hand.
		}
	};

	const ok = (value: string) => value.startsWith('ok');

	return (
		<div class="min-h-screen bg-zinc-100 p-4 text-sm text-zinc-800">
			<div class="mx-auto max-w-2xl">
				<h1 class="mb-1 text-xl font-semibold">FreeSpeech diagnostics</h1>
				<p class="mb-1 text-zinc-500">{done() ? 'All probes finished.' : 'Running probes…'}</p>
				<p class="mb-4 text-zinc-500">
					Report upload: <span class="font-medium text-zinc-700">{uploadState()}</span>
				</p>

				<h2 class="mb-2 font-semibold">Environment</h2>
				<div class="mb-4 rounded-md border border-zinc-300 bg-white p-3">
					<For each={Object.entries(environment())}>
						{([key, value]) => (
							<p class="break-all">
								<span class="text-zinc-500">{key}:</span> {value}
							</p>
						)}
					</For>
				</div>

				<h2 class="mb-2 font-semibold">Image probes</h2>
				<For each={probes()}>
					{(probe) => (
						<div class="mb-2 flex items-center gap-3 rounded-md border border-zinc-300 bg-white p-3">
							{/* The thumbnail is the ground truth: if it paints, the host works on this device. */}
							<img src={withBypass(probe.url)} alt="" class="h-12 w-12 shrink-0 rounded object-contain" />
							<div class="min-w-0">
								<p class="font-medium">{probe.label}</p>
								<p class={ok(probe.img) ? 'text-emerald-600' : 'text-red-600'}>via worker: {probe.img}</p>
								<p class={ok(probe.imgBypass) ? 'text-emerald-600' : 'text-red-600'}>
									bypassing worker: {probe.imgBypass}
								</p>
								<p class="break-all text-zinc-500">fetch: {probe.fetchNoCors}</p>
							</div>
						</div>
					)}
				</For>

				<h2 class="mt-4 mb-2 font-semibold">Board-layout probes</h2>
				<p class="mb-2 text-zinc-500">
					Both cards should show the word and image. The first uses the current renderer; the second recreates the old
					WebKit-sensitive renderer.
				</p>
				<div class="mb-3 flex flex-wrap gap-3">
					<div ref={currentOuter} class="relative h-36 w-44 rounded-md bg-zinc-200">
						<button
							ref={currentButton}
							type="button"
							class="absolute top-0 left-0 grid h-full w-full grid-rows-[auto_minmax(0,1fr)] gap-1 rounded-md border border-black bg-white p-2 px-1 text-black"
						>
							<div class="relative h-[24px] w-full shrink-0 text-lg">
								<p class="absolute top-1/2 left-0 w-full -translate-y-1/2 truncate text-center">Current</p>
							</div>
							<img
								ref={currentImage}
								src={IMAGE_PROBES[1].url}
								alt="Current board layout probe"
								class="block h-full min-h-0 w-full min-w-0 object-contain"
							/>
						</button>
					</div>
					<div ref={legacyOuter} class="relative h-36 w-44 rounded-md bg-zinc-200">
						<button
							ref={legacyButton}
							type="button"
							class="absolute top-0 left-0 flex h-full w-full flex-col justify-center gap-1 rounded-md border border-black bg-white p-2 px-1 text-black brightness-100"
						>
							<div class="relative h-[24px] w-full shrink-0 text-lg">
								<p class="absolute top-1/2 left-0 w-full -translate-y-1/2 truncate text-center">Legacy</p>
							</div>
							<div ref={legacyMedia} class="relative min-h-0 flex-1 overflow-hidden">
								<img
									ref={legacyImage}
									src={IMAGE_PROBES[1].url}
									alt="Legacy board layout probe"
									decoding="async"
									class="absolute inset-0 h-full w-full object-contain"
								/>
							</div>
						</button>
					</div>
				</div>
				<For each={layoutProbes()}>
					{(probe) => (
						<div class="mb-2 rounded-md border border-zinc-300 bg-white p-3">
							<p class="font-medium">{probe.label}</p>
							<p class="break-all text-zinc-500">
								outer {probe.outerRect}; button {probe.buttonRect}; media {probe.mediaRect}; image {probe.imageRect}
							</p>
							<p class="break-all text-zinc-500">{probe.imageState}</p>
							<p class="break-all text-zinc-500">{probe.computed}</p>
						</div>
					)}
				</For>

				<button
					type="button"
					onClick={copyReport}
					disabled={!done()}
					class="mt-2 mb-4 rounded-md bg-blue-500 px-4 py-2 font-medium text-white disabled:opacity-50"
				>
					{copied() ? 'Copied!' : 'Copy report'}
				</button>

				<pre class="overflow-x-auto rounded-md border border-zinc-300 bg-white p-3 text-xs">{report()}</pre>
			</div>
		</div>
	);
};

export default DebugPage;
