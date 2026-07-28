import type { AccessControlSettings } from '@/lib/types';
import { fetchFromAPI } from '../util';

const user = {
	update: updateUser,
	getAccessControls,
	updateAccessControls,
};

export default user;

async function updateUser(body: {
	name?: string;
	profileImgUrl?: string;
	elevenLabsApiKey?: string;
	usePersonalElevenLabsKey?: boolean;
}) {
	const response = (await fetchFromAPI({
		path: '/user/update',
		method: 'POST',
		body,
	})) as {
		success: boolean;
	};

	return response;
}

async function getAccessControls(): Promise<AccessControlSettings> {
	const response = (await fetchFromAPI({
		path: '/user/access-controls',
		method: 'GET',
	})) as { settings?: AccessControlSettings; error?: string };

	if (!response.settings) throw new Error(response.error || 'Could not load access controls');
	return response.settings;
}

async function updateAccessControls(
	settings: Omit<AccessControlSettings, 'updatedAt'>,
): Promise<AccessControlSettings> {
	const response = (await fetchFromAPI({
		path: '/user/access-controls',
		method: 'POST',
		body: settings,
	})) as { settings?: AccessControlSettings; error?: string };

	if (!response.settings) throw new Error(response.error || 'Could not update access controls');
	return response.settings;
}
