import type { Project, ProjectBlob } from '@/lib/types';
import { fetchFromAPI } from '../util';

const project = {
	list: listProjects,
	create: createProject,
	delete: deleteProject,
	updateThumbnail: updateProjectThumbnail,
	getImageStats: getImageStats,
	optimizeImages: optimizeImages,
	syncCheck: syncCheckProject,
	fetchBlob: fetchProjectBlob,
	syncBlob: syncProjectBlob,
	toggleFavorite: toggleFavorite,
	listTemplates: listTemplates,
	importTemplate: importTemplate,
};

async function deleteProject(projectId: string) {
	const response = (await fetchFromAPI({
		path: `/project/${projectId}/delete`,
		method: 'POST',
	})) as {
		success: boolean;
		error?: string;
	};
	return response;
}

export default project;

export type TemplateSummary = {
	slug: string;
	name: string;
	description: string;
	creatorName: string;
	thumbnailUrl: string;
	blobUrl: string;
};

async function listTemplates() {
	const response = (await fetchFromAPI({
		path: '/project/templates',
		method: 'GET',
	})) as { templates: TemplateSummary[] };

	return response;
}

async function importTemplate(slug: string) {
	const response = (await fetchFromAPI({
		path: '/project/import-template',
		method: 'POST',
		body: { slug },
	})) as {
		success: boolean;
		projectId?: string;
		error?: string;
	};

	return response;
}

async function listProjects(token?: string) {
	const response = (await fetchFromAPI({
		path: '/project/list',
		method: 'GET',
		token,
	})) as {
		projects: Project[];
	};

	return response;
}

async function createProject({ name, columns, rows }: { name: string; columns: number; rows: number }) {
	const response = (await fetchFromAPI({
		path: '/project/create',
		method: 'POST',
		body: { name, columns, rows, isPublic: false, description: '' },
	})) as {
		success: boolean;
		error: string;
		projectId: string;
	};

	return response;
}

async function updateProjectThumbnail(projectId: string) {
	const response = (await fetchFromAPI({
		path: `/project/${projectId}/update-thumbnail`,
		method: 'POST',
	})) as {
		success: boolean;
		error: string;
	};

	return response;
}

async function getImageStats(projectId: string) {
	const response = (await fetchFromAPI({
		path: `/project/${projectId}/optimize-images`,
		method: 'POST',
		body: { dryRun: true },
	})) as {
		imageCount: number;
		totalTilesWithImages: number;
		alreadyOptimized: number;
		error?: string;
	};

	return response;
}

async function optimizeImages(projectId: string) {
	const response = (await fetchFromAPI({
		path: `/project/${projectId}/optimize-images`,
		method: 'POST',
		body: { dryRun: false },
	})) as {
		optimized: number;
		failed: number;
		oldTotalSize: number;
		newTotalSize: number;
		savedBytes: number;
		error?: string;
	};

	return response;
}

// Lightweight endpoint for cache invalidation checks
async function syncCheckProject(projectId: string) {
	const response = (await fetchFromAPI({
		path: `/project/${projectId}/sync-check`,
		method: 'GET',
	})) as {
		id: string;
		lastEditedAt: string;
		updatedAt: string;
		error?: string;
	};

	return response;
}

// Fetch entire project as a single blob
async function fetchProjectBlob(projectId: string) {
	const response = (await fetchFromAPI({
		path: `/project/${projectId}/blob`,
		method: 'GET',
	})) as {
		blob: ProjectBlob;
		error?: string;
	};

	return response;
}

async function toggleFavorite(projectId: string) {
	const response = (await fetchFromAPI({
		path: `/project/${projectId}/favorite`,
		method: 'POST',
	})) as {
		isFavorite: boolean;
		error?: string;
	};

	return response;
}

// Sync local blob to server
async function syncProjectBlob(
	projectId: string,
	blob: ProjectBlob,
	lastEditedAt: string,
	force = false,
) {
	const response = (await fetchFromAPI({
		path: `/project/${projectId}/sync`,
		method: 'POST',
		body: { blob, lastEditedAt, force },
	})) as {
		success?: boolean;
		lastEditedAt?: string;
		error?: string;
		serverBlob?: ProjectBlob;
	};

	return response;
}
