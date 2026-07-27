import { useNavigate } from '@solidjs/router';
import { type Component, onMount } from 'solid-js';
import { resolveStartProjectId } from '@/lib/page-actions';

/**
 * /app entry point - Smart redirect handler
 *
 * The single place that decides which board to open when the app is started without one. Every
 * other entry point (the PWA start_url, the standalone redirect, the Home button off a board)
 * routes through here rather than resolving it themselves.
 *
 * 1. The last visited project, from localStorage
 * 2. Otherwise the first project in the dashboard's order — favourites, then most recently updated
 * 3. Otherwise the projects dashboard
 *
 * Auth is handled by the parent Layout, so we don't check it here.
 */
const AppEntryPage: Component = () => {
	const navigate = useNavigate();

	onMount(async () => {
		const projectId = await resolveStartProjectId();
		navigate(projectId ? `/app/project/${projectId}` : '/app/dashboard/projects', { replace: true });
	});

	// Return empty div while redirect happens
	return <div />;
};

export default AppEntryPage;
