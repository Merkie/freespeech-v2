import { fetchFromAPI } from '../util';

const user = {
	update: updateUser,
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
