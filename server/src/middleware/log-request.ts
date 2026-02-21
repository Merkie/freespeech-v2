import type { NextFunction, Request, Response } from 'express';

export default function LogRequestMiddleware(req: Request, _res: Response, next: NextFunction) {
	console.log(`[${new Date(Date.now()).toLocaleString()}] ${req.method} ${req.path}`);
	next();
}
