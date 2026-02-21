import Cryptr from 'cryptr';
import { SITE_SECRET } from './env';

export function DecryptElevenLabsKey(encKey?: string | undefined | null) {
	let userKey = '';

	if (encKey) {
		const cryptr = new Cryptr(SITE_SECRET);
		userKey = cryptr.decrypt(encKey);
	}

	return userKey;
}
