import type { AccessControlSettings } from '@/lib/types';
import { fetchFromAPI } from '../util';

const user = {
	update: updateUser,
	getAccessControls,
	updateAccessControls,
	updateCollaboration,
	exportData,
	getElevenLabsKey,
	deleteAccount,
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
		path: '/user/access-controls?sw-bypass=1',
		method: 'GET',
		options: { timeoutMs: 5000 },
	})) as { settings?: AccessControlSettings; error?: string };

	if (!response.settings) throw new Error(response.error || 'Could not load access controls');
	return response.settings;
}

async function updateAccessControls(
	settings: Pick<AccessControlSettings, 'enabled' | 'mode' | 'pinHash' | 'pinSalt'>,
): Promise<AccessControlSettings> {
	const response = (await fetchFromAPI({
		path: '/user/access-controls',
		method: 'POST',
		body: settings,
	})) as { settings?: AccessControlSettings; error?: string };

	if (!response.settings) throw new Error(response.error || 'Could not update access controls');
	return response.settings;
}

async function updateCollaboration(enabled: boolean): Promise<boolean> {
	const response = (await fetchFromAPI({
		path: '/user/collaboration',
		method: 'POST',
		body: { enabled },
	})) as { enabled?: boolean; error?: string };

	if (typeof response.enabled !== 'boolean') throw new Error(response.error || 'Could not update collaboration');
	return response.enabled;
}

/** Downloads the account export as a JSON file. */
async function exportData(): Promise<Blob> {
	const response = (await fetchFromAPI({
		path: '/user/export?sw-bypass=1',
		method: 'GET',
		options: { parseResponseJson: false, timeoutMs: 60000 },
	})) as Response;
	if (!response.ok) throw new Error('Could not download your data');
	return response.blob();
}

/** Password accounts confirm with the password; Google-only accounts with their email address. */
async function deleteAccount(confirmation: { password?: string; email?: string }) {
	return (await fetchFromAPI({
		path: '/user/delete-account',
		method: 'POST',
		body: confirmation,
		options: { timeoutMs: 60000 },
	})) as { success?: boolean; error?: string };
}

async function getElevenLabsKey(): Promise<string> {
	const response = (await fetchFromAPI({
		path: '/user/get-eleven-labs-key?sw-bypass=1',
		method: 'GET',
		options: { timeoutMs: 10000 },
	})) as { key?: string; error?: string };
	if (typeof response.key !== 'string') throw new Error(response.error || 'Could not load the key');
	return response.key;
}
