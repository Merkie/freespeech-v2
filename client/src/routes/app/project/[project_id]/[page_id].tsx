import { useNavigate, useParams } from '@solidjs/router';
import { type Component, onMount } from 'solid-js';

// Legacy route handler - redirects old URLs with page_id to new format
// Old: /app/project/:project_id/:page_id
// New: /app/project/:project_id (page managed in state)
const LegacyPageRedirect: Component = () => {
	const params = useParams();
	const navigate = useNavigate();

	onMount(() => {
		// Preserve the explicit target in the URL until the new route has loaded the board.
		navigate(`/app/project/${params.project_id}?page=${encodeURIComponent(params.page_id ?? '')}`, { replace: true });
	});

	return null;
};

export default LegacyPageRedirect;
