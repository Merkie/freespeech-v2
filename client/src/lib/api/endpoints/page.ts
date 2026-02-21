import { fetchFromAPI } from '../util';
import type { TilePage, Template, Tile, PageTemplateLink } from '@/lib/types';

const page = {
  edit: editPage,
  update: editPage,
  delete: deletePage,
  create: createPage,
  linkTemplate: linkTemplate,
  unlinkTemplate: unlinkTemplate,
  viewWithTemplate: viewWithTemplate,
};

export default page;

async function deletePage(pageId: string) {
  const response = (await fetchFromAPI({
    path: `/page/${pageId}/delete`,
    method: 'DELETE',
  })) as {
    success: boolean;
    error: string;
  };

  return response;
}

async function createPage(body: { name: string; projectId: string }) {
  const response = (await fetchFromAPI({
    path: '/page/create',
    method: 'POST',
    body,
  })) as {
    success: boolean;
    error: string;
  };

  return response;
}

async function editPage(
  pageId: string,
  body: {
    name: string;
  }
) {
  const response = (await fetchFromAPI({
    path: `/page/${pageId}/update`,
    method: 'POST',
    body,
  })) as {
    success: boolean;
    error: string;
  };

  return response;
}

async function linkTemplate(pageId: string, templatePageId: string) {
  const response = (await fetchFromAPI({
    path: `/v2/page/${pageId}/link-template`,
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
    path: `/v2/page/${pageId}/unlink-template`,
    method: 'POST',
  })) as {
    success: boolean;
  };

  return response;
}

async function viewWithTemplate(pageId: string) {
  const response = (await fetchFromAPI({
    path: `/v2/page/${pageId}/with-template`,
    method: 'GET',
  })) as {
    page: TilePage;
    template: Template | null;
    templateTiles: Tile[];
  };

  return response;
}
