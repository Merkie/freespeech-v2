import type { Project, ProjectBlob } from '@/lib/types';
import { fetchFromAPI } from '../util';

const project = {
	list: listProjects,
	create: createProject,
	updateThumbnail: updateProjectThumbnail,
	getImageStats: getImageStats,
	optimizeImages: optimizeImages,
	syncCheck: syncCheckProject,
	fetchBlob: fetchProjectBlob,
	syncBlob: syncProjectBlob,
};

export default project;

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
