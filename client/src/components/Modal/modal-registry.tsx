import { MODAL_ID, type ModalIdType } from '@/lib/constants';
import CreatePage from './_modal_inners/CreatePage';
import CreateProject from './_modal_inners/CreateProject';
import EditPage from './_modal_inners/EditPage';
import ManagePages from './_modal_inners/ManagePages';
import OptimizeImages from './_modal_inners/OptimizeImages';
import PinEntry, { pinEntryTitle } from './_modal_inners/PinEntry';
import PinSetup from './_modal_inners/PinSetup';
import SaveEditMode from './_modal_inners/SaveEditMode';
import SyncConflict from './_modal_inners/SyncConflict';

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
	[MODAL_ID.OPTIMIZE_IMAGES]: {
		title: 'Optimize Images',
		innerElement: OptimizeImages,
	},
	[MODAL_ID.SAVE_EDIT_MODE]: {
		title: 'Unsaved Changes',
		innerElement: SaveEditMode,
	},
	[MODAL_ID.SYNC_CONFLICT]: {
		title: 'Sync Conflict',
		innerElement: SyncConflict,
	},
	[MODAL_ID.PIN_ENTRY]: {
		title: pinEntryTitle,
		innerElement: PinEntry,
	},
	[MODAL_ID.PIN_SETUP]: {
		title: 'Set Passcode',
		innerElement: PinSetup,
	},
};
