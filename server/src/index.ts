import { init } from './utils/env';

init();

import { fal } from '@fal-ai/client';
import { StartCrons } from './crons';
import StartServer from './server/start-server';

fal.config({
	credentials: process.env.FAL_KEY!,
});

StartCrons();
StartServer();
