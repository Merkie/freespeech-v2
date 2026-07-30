import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextFunction, Request, Response } from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getAppVersion(): string {
	if (process.env.APP_VERSION) return process.env.APP_VERSION;

	try {
		const releaseVersion = readFileSync(path.resolve(__dirname, '..', '..', '..', '.release-version'), 'utf-8').trim();
		if (releaseVersion) return releaseVersion;
	} catch {
		// Local development and a checkout that has not been deployed use the package fallback.
	}

	try {
		const pkg = JSON.parse(readFileSync(path.resolve(__dirname, '..', '..', 'package.json'), 'utf-8'));
		return pkg.version || '1.0.0';
	} catch {
		return '1.0.0';
	}
}

const APP_VERSION = getAppVersion();

export default function AppVersionMiddleware(_req: Request, res: Response, next: NextFunction) {
	res.setHeader('x-app-version', APP_VERSION);
	next();
}
