import express, { type Express } from 'express';
import 'express-async-errors';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import { router } from 'express-file-routing';
import HandleErrorMiddleware from '@/middleware/handle-error';
import LogRequestMiddleware from '@/middleware/log-request';
// import { WebsocketServer } from "./websocket/websocket-server";
import { PORT } from '@/utils/env';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function StartServer() {
	const app: Express = express();
	const port = parseInt(PORT, 10);

	app.use(cors());
	app.options('*', cors());

	app.use(express.json({ limit: '100mb' }));

	app.use(LogRequestMiddleware);

	app.use(await router({ directory: path.join(__dirname, '..', 'routes') }));

	// Production: serve client build
	if (process.env.NODE_ENV === 'production') {
		const clientDist = path.resolve(__dirname, '..', '..', '..', 'client', 'dist');
		app.use(express.static(clientDist));
		app.get('*', (_req, res) => {
			res.sendFile(path.join(clientDist, 'index.html'));
		});
	}

	app.use(HandleErrorMiddleware);

	const server = http.createServer(app);

	// server.on("upgrade", async (request, socket, head) => {
	//   const token = request.url?.split("?token=").at(-1);

	//   if (!token) {
	//     socket.destroy();
	//     return;
	//   }

	//   WebsocketServer.handleUpgrade(request, socket, head, (ws) => {
	//     WebsocketServer.emit("connection", ws, request);
	//   });
	// });

	server.listen(port, () => {
		console.log(`[server]: Server is running at http://localhost:${port}`);
	});
}
