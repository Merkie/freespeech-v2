import { useNavigate } from '@solidjs/router';
import type { Component } from 'solid-js';
import { onMount } from 'solid-js';

const TemplatesPage: Component = () => {
	const navigate = useNavigate();

	onMount(() => {
		// Templates are now managed per-project via blob.
		// Redirect to projects page.
		navigate('/app/dashboard/projects', { replace: true });
	});

	return (
		<div class="flex flex-col items-center justify-center gap-4 p-8 text-center">
			<i class="bi bi-grid-3x3 text-4xl text-zinc-400" />
			<div class="text-zinc-500">
				<p class="mb-1 font-medium">Templates are now per-project</p>
				<p class="text-sm">Manage templates from within each project's edit mode</p>
			</div>
		</div>
	);
};

export default TemplatesPage;
