import cron from 'node-cron';
import { invalidateCacheAllExpired } from '@/resources/cache';

const ExampleCron = {
	start: startExampleCron,
};

export default ExampleCron;

let isRunning = false;

async function startExampleCron() {
	cron.schedule('*/30 * * * *', async () => {
		if (isRunning) return;

		isRunning = true;

		invalidateCacheAllExpired();

		isRunning = false;
	});
}
