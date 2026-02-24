import type { PageTemplateLink, Template } from '@/lib/types';
import { fetchFromAPI } from '../util';

const page = {
	linkTemplate: linkTemplate,
	unlinkTemplate: unlinkTemplate,
};

export default page;

async function linkTemplate(pageId: string, templatePageId: string) {
	const response = (await fetchFromAPI({
		path: `/page/${pageId}/link-template`,
		method: 'POST',
		body: { templatePageId },
	})) as {
		link: PageTemplateLink;
		template: Template;
	};

	return response;
}

async function unlinkTemplate(pageId: string) {
	const response = (await fetchFromAPI({
		path: `/page/${pageId}/unlink-template`,
		method: 'POST',
	})) as {
		success: boolean;
	};

	return response;
}
