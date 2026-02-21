import { useNavigate } from '@solidjs/router';
import { onMount, type Component } from 'solid-js';
import { localSettings } from '@/lib/state';

/**
 * /app entry point - Smart redirect handler
 *
 * This is the PWA start_url landing point. It redirects users to:
 * 1. Their last visited project (if one exists in localStorage)
 * 2. The projects dashboard (as fallback)
 *
 * Auth is handled by the parent Layout, so we don't check it here.
 */
const AppEntryPage: Component = () => {
  const navigate = useNavigate();

  onMount(() => {
    const lastProjectId = localSettings().lastVisitedProjectId;

    if (lastProjectId) {
      // Redirect to last visited project
      navigate(`/app/project/${lastProjectId}`, { replace: true });
    } else {
      // Default: go to projects dashboard
      navigate('/app/dashboard/projects', { replace: true });
    }
  });

  // Return empty div while redirect happens
  return <div />;
};

export default AppEntryPage;
