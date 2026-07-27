import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Request, Response } from 'express';

// Receives reports from the client's /debug diagnostics page. That page exists for bugs that only
// reproduce on one physical device, so its report has to make it off the device somehow — pasting
// JSON out of a misbehaving iPad is exactly the step that kept failing. Reports land as files
// under server/debug-reports/ (gitignored), readable straight off the box.

const REPORT_DIR = path.resolve(import.meta.dirname, '..', '..', 'debug-reports');

// Diagnostics, not telemetry: keep only the newest few and cap the size, so an unauthenticated
// endpoint can never become meaningful storage.
const MAX_REPORTS = 50;
const MAX_REPORT_BYTES = 64 * 1024;

export const post = [
	async (req: Request, res: Response) => {
		const body = JSON.stringify(req.body ?? {}, null, 2);
		if (body.length > MAX_REPORT_BYTES) {
			return res.status(413).json({ success: false, error: 'Report too large' });
		}

		await mkdir(REPORT_DIR, { recursive: true });

		// Filename carries what the report itself might be missing if collection broke early.
		const stamp = new Date().toISOString().replace(/[:.]/g, '-');
		const report = {
			receivedAt: new Date().toISOString(),
			ip: req.headers['cf-connecting-ip'] ?? req.ip,
			userAgent: req.headers['user-agent'] ?? '',
			report: req.body ?? {},
		};
		await writeFile(path.join(REPORT_DIR, `${stamp}.json`), JSON.stringify(report, null, 2));

		const existing = (await readdir(REPORT_DIR)).filter((name) => name.endsWith('.json')).sort();
		for (const name of existing.slice(0, Math.max(0, existing.length - MAX_REPORTS))) {
			await unlink(path.join(REPORT_DIR, name));
		}

		res.json({ success: true });
	},
];
