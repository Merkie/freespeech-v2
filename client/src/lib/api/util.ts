/* eslint-disable @typescript-eslint/no-explicit-any */

import { checkVersionHeader } from '@/lib/version-check';

export class OfflineError extends Error {
	constructor() {
		super('No internet connection');
		this.name = 'OfflineError';
	}
}

export async function fetchFromAPI({
	path,
	method,
	body,
	token,
	options,
}: {
	path: string;
	method: 'GET' | 'POST' | 'DELETE';
	body?: any;
	token?: string;
	options?: {
		parseResponseJson?: boolean;
	};
}) {
	if (!navigator.onLine) {
		throw new OfflineError();
	}

	let headers: HeadersInit = {
		'Content-Type': 'application/json',
	};

	try {
		const authToken = `${token ? token : localStorage.getItem('token')}`;

		if (authToken) {
			headers = {
				...headers,
				Authorization: `Bearer ${authToken}`,
			};
		}
	} catch {
		// do nothing
	}

	const response = await fetch(import.meta.env.VITE_API_URL + path, {
		method,
		headers,
		body: JSON.stringify(body),
	});

	checkVersionHeader(response);

	if (options?.parseResponseJson === false) {
		return response;
	}

	const data = await response.json();
	return data;
}
