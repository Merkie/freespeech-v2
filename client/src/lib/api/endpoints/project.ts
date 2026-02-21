/* eslint-disable @typescript-eslint/no-explicit-any */
import type { OBFPage } from '@/lib/openboardformat';
import type { Project, TilePage, TilePageInProject } from '@/lib/types';
import { fetchFromAPI } from '../util';

const project = {
  view: viewProject,
  list: listProjects,
  listPages: listProjectPages,
  create: createProject,
  delete: deleteProject,
  edit: editProject,
  viewPage: viewPageInProject,
  import: {
    obf: importObf,
    obz: importObz,
  },
  updateThumbnail: updateProjectThumbnail,
  getImageStats: getImageStats,
  optimizeImages: optimizeImages,
  syncCheck: syncCheckProject,
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

async function listProjectPages(projectId: string) {
  const response = (await fetchFromAPI({
    path: `/project/${projectId}/pages`,
    method: 'GET',
  })) as {
    pages: TilePage[];
  };

  return response;
}

async function createProject({
  name,
  columns,
  rows,
}: {
  name: string;
  columns: number;
  rows: number;
}) {
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

async function deleteProject(projectId: string) {
  const response = (await fetchFromAPI({
    path: `/project/${projectId}/delete`,
    method: 'DELETE',
  })) as {
    success: boolean;
    error: string;
  };

  return response;
}

async function editProject(
  projectId: string,
  body: {
    name?: string;
    columns?: number;
    rows?: number;
    imageUrl?: string;
  }
) {
  const response = (await fetchFromAPI({
    path: `/project/${projectId}/update`,
    method: 'POST',
    body,
  })) as {
    success: boolean;
    error: string;
  };

  return response;
}

async function viewProject(projectId: string, token?: string) {
  const response = (await fetchFromAPI({
    path: `/project/${projectId}/view`,
    method: 'GET',
    token,
  })) as {
    project: Project;
    error: string;
  };

  return response;
}

async function viewPageInProject(
  projectId: string,
  pageId: string,
  token?: string
) {
  const response = (await fetchFromAPI({
    path: `/project/${projectId}/view-page-in-project`,
    method: 'POST',
    body: { pageId },
    token,
  })) as {
    page: TilePageInProject;
    isHomePage: boolean;
    error: string;
  };

  return response;
}

async function importObf(body: OBFPage) {
  const response = (await fetchFromAPI({
    path: '/project/import/obf',
    method: 'POST',
    body,
  })) as {
    success: boolean;
    error: string;
    projectId: string;
  };

  return response;
}

async function importObz(body: {
  manifest: any;
  obfFiles: (
    | {
        fileName: string;
        data: any;
      }
    | undefined
  )[];
}) {
  const response = (await fetchFromAPI({
    path: '/project/import/obz',
    method: 'POST',
    body,
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
