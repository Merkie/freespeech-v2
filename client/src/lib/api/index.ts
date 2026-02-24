import auth from './endpoints/auth';
import media from './endpoints/media';
import project from './endpoints/project';
import tts from './endpoints/tts';
import user from './endpoints/user';

const api = {
	auth,
	media,
	user,
	tts,
	project,
};

export default api;
