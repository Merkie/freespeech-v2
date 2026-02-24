export const MODAL_ID = {
	CREATE_PROJECT: 'create-project',
	CREATE_PAGE: 'create-page',
	MANAGE_PAGES: 'manage-pages',
	EDIT_PAGE: 'edit-page',
	CREATE_TEMPLATE: 'create-template',
	APPLY_TEMPLATE: 'apply-template',
	EDIT_TEMPLATE_DETAILS: 'edit-template-details',
	MANAGE_TEMPLATES: 'manage-templates',
	OPTIMIZE_IMAGES: 'optimize-images',
	SAVE_EDIT_MODE: 'save-edit-mode',
} as const;

export type ModalIdType = (typeof MODAL_ID)[keyof typeof MODAL_ID];
