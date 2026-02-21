import { useNavigate, useParams } from '@solidjs/router';
import { type Component, onMount } from 'solid-js';
import { navigateToPageInProject } from '@/lib/page-actions';

// Legacy route handler - redirects old URLs with page_id to new format
// Old: /app/project/:project_id/:page_id
// New: /app/project/:project_id (page managed in state)
const LegacyPageRedirect: Component = () => {
	const params = useParams();
	const navigate = useNavigate();

	onMount(() => {
		// Set the page ID in state before redirecting
		if (params.page_id) {
			navigateToPageInProject(params.page_id);
		}
		// Redirect to the new URL format
		navigate(`/app/project/${params.project_id}`, { replace: true });
	});

	return null;
};

export default LegacyPageRedirect;
