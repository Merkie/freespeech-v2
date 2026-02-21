import { useSearchParams, useNavigate } from '@solidjs/router';
import { onMount, createSignal, Show } from 'solid-js';
import { setUser } from '@/lib/state';
import api from '@/lib/api';

function Page() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = createSignal<string | null>(null);

  onMount(async () => {
    try {
      if (!searchParams.code) {
        setError('No authorization code received');
        return;
      }

      // Exchange code for token using the API client
      const response = await api.auth.oauth.google(
        window.location.origin,
        window.location.search
      );

      if (!response.token) {
        setError('No token received from server');
        return;
      }

      localStorage.setItem('token', response.token);

      // Fetch user data
      const userData = await api.auth.me(response.token);

      if (userData.user) {
        setUser(userData.user);
      }

      navigate('/app/dashboard/projects', { replace: true });
    } catch (err) {
      console.error('OAuth error:', err);
      setError('Authentication failed. Please try again.');
    }
  });

  return (
    <main class="grid h-screen place-items-center bg-zinc-100">
      <Show
        when={error()}
        fallback={
          <div class="text-center">
            <div class="mb-4 text-lg text-zinc-600">One moment...</div>
            <div class="text-sm text-zinc-400">
              Completing authentication...
            </div>
          </div>
        }
      >
        <div class="text-center">
          <div class="mb-4 text-lg text-red-600">{error()}</div>
          <a href="/login" class="text-blue-600 underline">
            Return to login
          </a>
        </div>
      </Show>
    </main>
  );
}

export default Page;
