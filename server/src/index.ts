import { init } from './utils/env';

init();

import { fal } from '@fal-ai/client';
import StartServer from './server/start-server';

fal.config({
	credentials: process.env.FAL_KEY!,
});

StartServer();
