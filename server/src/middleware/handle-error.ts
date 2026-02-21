import type { NextFunction, Request, Response } from 'express';

export default function HandleErrorMiddleware(err: Error, _req: Request, res: Response, _next: NextFunction) {
	console.error(err.stack);
	res.status(500).json({ error: err.message });
}
