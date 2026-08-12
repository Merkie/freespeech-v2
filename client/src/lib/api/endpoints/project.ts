import type {
	CollaborationInvitation,
	CollaborationUser,
	Project,
	ProjectBlob,
	ProjectCollaborator,
} from '@/lib/types';
import { checkVersionHeader } from '@/lib/version-check';
import { fetchFromAPI, OfflineError } from '../util';

const project = {
	list: listProjects,
	create: createProject,
	delete: deleteProject,
	duplicate: duplicateProject,
	updateThumbnail: updateProjectThumbnail,
	getImageStats: getImageStats,
	optimizeImages: optimizeImages,
	syncCheck: syncCheckProject,
	fetchBlob: fetchProjectBlob,
	syncBlob: syncProjectBlob,
	toggleFavorite: toggleFavorite,
	listTemplates: listTemplates,
	importTemplate: importTemplate,
	importOpenBoard: importOpenBoard,
	listInvitations,
	respondToInvitation,
	listCollaborators,
	lookupCollaborator,
	inviteCollaborator,
	removeCollaborator,
	leaveCollaboration,
};

export type OpenBoardImportResult = {
	success?: boolean;
	projectId?: string;
	pageCount?: number;
	tileCount?: number;
	imagesResolved?: number;
	imagesTotal?: number;
	error?: string;
};

/**
 * Uploads a .obf/.obz as raw bytes rather than through fetchFromAPI, which JSON-encodes its body.
 * Base64 would inflate a large archive by a third for no benefit.
 */
async function importOpenBoard(file: File): Promise<OpenBoardImportResult> {
	if (!navigator.onLine) throw new OfflineError();

	// Read the file up front rather than handing the File straight to fetch. A File is a lazy
	// handle onto the disk that the browser reads while the request is already in flight, so an
	// unreadable file surfaces as a bare network error with nothing to report to the user. Reading
	// first turns that into a catchable failure before anything is sent. Boards are capped at
	// 50 MB, so holding one in memory briefly is cheap.
	const bytes = await file.arrayBuffer();

	const token = localStorage.getItem('token') ?? '';
	const response = await fetch(
		`${import.meta.env.VITE_API_URL}/project/import/open-board?filename=${encodeURIComponent(file.name)}`,
		{
			method: 'POST',
			headers: {
				'Content-Type': 'application/octet-stream',
				...(token ? { Authorization: `Bearer ${token}` } : {}),
			},
			body: bytes,
		},
	);

	checkVersionHeader(response);

	try {
		return (await response.json()) as OpenBoardImportResult;
	} catch {
		return { error: 'The server returned an unexpected response.' };
	}
}

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

async function duplicateProject(projectId: string) {
	return (await fetchFromAPI({
		path: `/project/${projectId}/duplicate`,
		method: 'POST',
	})) as { success?: boolean; project?: { id: string; name: string }; error?: string };
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
		// The dashboard has its own IndexedDB fallback containing only boards that can really open
		// offline. Bypass the worker's older cached full list so a stale navigator.onLine value does
		// not make unavailable boards appear usable after an iPad wakes without connectivity.
		path: '/project/list?sw-bypass=1',
		method: 'GET',
		token,
		options: { timeoutMs: 5000 },
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
async function syncProjectBlob(projectId: string, blob: ProjectBlob, lastEditedAt: string, force = false) {
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

async function listInvitations() {
	return (await fetchFromAPI({
		path: '/collaboration/invitations',
		method: 'GET',
	})) as { invitations: CollaborationInvitation[]; error?: string };
}

async function respondToInvitation(invitationId: string, action: 'accept' | 'decline') {
	return (await fetchFromAPI({
		path: '/collaboration/invitations',
		method: 'POST',
		body: { invitationId, action },
	})) as { success?: boolean; error?: string };
}

async function listCollaborators(projectId: string) {
	return (await fetchFromAPI({
		path: `/project/${projectId}/collaborators`,
		method: 'GET',
	})) as {
		project?: { id: string; name: string };
		collaborators?: ProjectCollaborator[];
		error?: string;
	};
}

async function lookupCollaborator(projectId: string, email: string) {
	return (await fetchFromAPI({
		path: `/project/${projectId}/collaborators`,
		method: 'POST',
		body: { action: 'lookup', email },
	})) as { candidate?: Required<CollaborationUser>; status?: 'pending' | 'accepted' | null; error?: string };
}

async function inviteCollaborator(projectId: string, userId: string) {
	return (await fetchFromAPI({
		path: `/project/${projectId}/collaborators`,
		method: 'POST',
		body: { action: 'invite', userId },
	})) as { success?: boolean; error?: string };
}

async function removeCollaborator(projectId: string, userId: string) {
	return (await fetchFromAPI({
		path: `/project/${projectId}/collaborators`,
		method: 'DELETE',
		body: { userId },
	})) as { success?: boolean; error?: string };
}

async function leaveCollaboration(projectId: string) {
	return (await fetchFromAPI({
		path: `/project/${projectId}/collaboration`,
		method: 'DELETE',
	})) as { success?: boolean; error?: string };
}
