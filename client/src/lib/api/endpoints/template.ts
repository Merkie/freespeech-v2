import type { Template } from '@/lib/types';
import { fetchFromAPI } from '../util';

const template = {
	list: listTemplates,
	create: createTemplate,
	update: updateTemplate,
	delete: deleteTemplate,
};

export default template;

async function listTemplates(filters?: { projectId?: string }) {
	const params = new URLSearchParams();
	if (filters?.projectId) {
		params.set('projectId', filters.projectId);
	}
	const queryString = params.toString();
	const path = `/template/list${queryString ? `?${queryString}` : ''}`;

	const response = (await fetchFromAPI({
		path,
		method: 'GET',
	})) as {
		templates: Template[];
	};

	return response;
}

async function createTemplate(body: {
	name: string;
	projectId: string;
	tiles?: {
		x: number;
		y: number;
		page?: number;
		text?: string;
		backgroundColor?: string;
		borderColor?: string;
		image?: string;
		navigation?: string;
		displayText?: string;
	}[];
}) {
	const response = (await fetchFromAPI({
		path: '/template/create',
		method: 'POST',
		body,
	})) as {
		template: Template;
	};

	return response;
}

async function updateTemplate(templateId: string, body: { name?: string }) {
	const response = (await fetchFromAPI({
		path: `/template/${templateId}/update`,
		method: 'POST',
		body,
	})) as {
		template: Template;
	};

	return response;
}

async function deleteTemplate(templateId: string) {
	const response = (await fetchFromAPI({
		path: `/template/${templateId}/delete`,
		method: 'DELETE',
	})) as {
		success: boolean;
		error?: string;
	};

	return response;
}
