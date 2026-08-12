export const MODAL_ID = {
	CREATE_PROJECT: 'create-project',
	CREATE_PAGE: 'create-page',
	MANAGE_PAGES: 'manage-pages',
	EDIT_PAGE: 'edit-page',
	OPTIMIZE_IMAGES: 'optimize-images',
	SAVE_EDIT_MODE: 'save-edit-mode',
	SYNC_CONFLICT: 'sync-conflict',
	PIN_ENTRY: 'pin-entry',
	PIN_SETUP: 'pin-setup',
	MANAGE_COLLABORATORS: 'manage-collaborators',
} as const;

export type ModalIdType = (typeof MODAL_ID)[keyof typeof MODAL_ID];
