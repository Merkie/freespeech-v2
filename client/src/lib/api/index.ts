import auth from './endpoints/auth';
import media from './endpoints/media';
import page from './endpoints/page';
import project from './endpoints/project';
import template from './endpoints/template';
import tts from './endpoints/tts';
import user from './endpoints/user';

const api = {
	auth,
	media,
	user,
	tts,
	project,
	page,
	template,
};

export default api;
