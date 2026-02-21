import { MODAL_ID, type ModalIdType } from '@/lib/constants';
import CreateProject from './_modal_inners/CreateProject';
import CreatePage from './_modal_inners/CreatePage';
import ManagePages from './_modal_inners/ManagePages';
import EditPage from './_modal_inners/EditPage';
import CreateTemplate from './_modal_inners/CreateTemplate';
import ApplyTemplate from './_modal_inners/ApplyTemplate';
import EditTemplateDetails from './_modal_inners/EditTemplateDetails';
import ManageTemplates from './_modal_inners/ManageTemplates';
import OptimizeImages from './_modal_inners/OptimizeImages';

type ModalConfig = {
  title: string | (() => string);
  innerElement: any;
};

export const MODAL_REGISTRY: Record<ModalIdType, ModalConfig> = {
  [MODAL_ID.CREATE_PROJECT]: {
    title: 'Create Project',
    innerElement: CreateProject,
  },
  [MODAL_ID.CREATE_PAGE]: {
    title: 'Create Page',
    innerElement: CreatePage,
  },
  [MODAL_ID.MANAGE_PAGES]: {
    title: 'Manage Pages',
    innerElement: ManagePages,
  },
  [MODAL_ID.EDIT_PAGE]: {
    title: 'Edit Page',
    innerElement: EditPage,
  },
  [MODAL_ID.CREATE_TEMPLATE]: {
    title: 'Create Template',
    innerElement: CreateTemplate,
  },
  [MODAL_ID.APPLY_TEMPLATE]: {
    title: 'Apply Template',
    innerElement: ApplyTemplate,
  },
  [MODAL_ID.EDIT_TEMPLATE_DETAILS]: {
    title: 'Edit Template',
    innerElement: EditTemplateDetails,
  },
  [MODAL_ID.MANAGE_TEMPLATES]: {
    title: 'Manage Templates',
    innerElement: ManageTemplates,
  },
  [MODAL_ID.OPTIMIZE_IMAGES]: {
    title: 'Optimize Images',
    innerElement: OptimizeImages,
  },
};
