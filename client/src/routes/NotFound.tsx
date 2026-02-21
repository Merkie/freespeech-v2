import { useNavigate } from '@solidjs/router';
import { type Component, onMount } from 'solid-js';
import { user } from '@/lib/state';

// 404 catch-all - redirects to dashboard if logged in, or home if not
const NotFound: Component = () => {
	const navigate = useNavigate();

	onMount(() => {
		if (user()) {
			navigate('/app/dashboard/projects', { replace: true });
		} else {
			navigate('/', { replace: true });
		}
	});

	return null;
};

export default NotFound;
