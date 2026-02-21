import { createSignal } from 'solid-js';
import { A } from '@solidjs/router';
import api from '@/lib/api';

function Page() {
  const [googleUrl, setGoogleUrl] = createSignal<string | null>(null);

  const loadGoogleUrl = async () => {
    const response = await api.auth.oauth.getOAuthUrls(window.location.origin);
    if (response.google) {
      setGoogleUrl(response.google);
    }
  };

  loadGoogleUrl();

  const handleGoogleLogin = () => {
    const url = googleUrl();
    if (url) {
      window.location.assign(url);
    }
  };

  return (
    <main class="grid h-screen place-items-center bg-zinc-100">
      <div class="flex w-full max-w-[800px] flex-col gap-16">
        <div class="text-center">
          <h1 class="text-4xl font-bold text-zinc-900">Login To Free Speech</h1>
        </div>
        <div class="flex flex-col border-y border-zinc-200 bg-zinc-50 p-4 sm:rounded-md sm:border">
          <button
            onClick={handleGoogleLogin}
            disabled={!googleUrl()}
            class="mb-4"
          >
            <div class="flex items-center justify-center gap-4 rounded-md border border-zinc-200 p-4 transition-all hover:bg-zinc-100">
              <img
                src="https://cdn.iconscout.com/icon/free/png-256/free-google-1772223-1507807.png"
                width={20}
                alt="Google"
              />
              <span class="text-zinc-800">Continue with Google</span>
            </div>
          </button>
          <A href="/login/email">
            <div class="flex items-center justify-center gap-4 rounded-md border border-zinc-200 p-4 transition-all hover:bg-zinc-100">
              <svg
                class="h-5 w-5 text-zinc-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              <span class="text-zinc-800">Continue with Email</span>
            </div>
          </A>
          <A href="/register" class="mt-4 p-4 text-zinc-400">
            <span class="mr-4">Don't have an account?</span>
            <svg
              class="inline h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </A>
        </div>
      </div>
    </main>
  );
}

export default Page;
