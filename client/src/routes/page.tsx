import { A } from '@solidjs/router';
import { Show } from 'solid-js';
import { user } from '@/lib/state';
import { useMouseParallax } from '@/hooks/useMouseParallax';

function Page() {
  // Subtle parallax effect for hero image layers
  const { getLayerOffset } = useMouseParallax({
    maxOffset: 15, // Max 15px movement from mouse
    maxScrollOffset: 60, // Max 60px movement from scroll
    smoothing: 0.08, // Smooth, gentle response
  });

  return (
    <div class="min-h-screen bg-gray-100">
      {/* Navbar */}
      <nav class="fixed top-0 left-0 z-50 w-full border-b border-gray-200/50 bg-white/60 backdrop-blur-md">
        <div class="mx-auto flex h-[72px] max-w-[1200px] items-center justify-between px-6 lg:px-12">
          {/* Logo and Title */}
          <div class="flex items-center gap-3">
            <img src="/logo.png" class="h-10 w-10" alt="FreeSpeech AAC Logo" />
            <span class="text-xl font-semibold text-gray-900">
              FreeSpeech AAC
            </span>
          </div>

          {/* Open App Button */}
          <Show
            when={user()}
            fallback={
              <A
                href="/login"
                class="rounded-full bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(59,130,246,0.4)] transition-all hover:shadow-[0_6px_20px_rgba(59,130,246,0.5)] hover:brightness-105"
              >
                Open App <span class="ml-1">&rarr;</span>
              </A>
            }
          >
            <A
              href="/app/dashboard/projects"
              class="rounded-full bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(59,130,246,0.4)] transition-all hover:shadow-[0_6px_20px_rgba(59,130,246,0.5)] hover:brightness-105"
            >
              Open App <span class="ml-1">&rarr;</span>
            </A>
          </Show>
        </div>
      </nav>

      {/* Main Content Container */}
      <div class="mx-auto max-w-[1200px] overflow-x-hidden bg-white shadow-sm">
        {/* Hero Section */}
        <section class="relative pt-[72px]">
          {/* Mobile Hero Image - Parallax layers, overblown off right edge */}
          <div class="pointer-events-none relative -mt-[100px] mb-32 h-[350px] sm:h-[420px] md:hidden">
            {/* Background layers (4-5) */}
            <img
              src="/hero-parallax-layer-5.webp"
              alt=""
              class="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[160%] max-w-[1000px] object-contain"
              style={{
                transform: `translate(${getLayerOffset(0.1).x}px, ${getLayerOffset(0.1).y}px)`,
              }}
            />
            <img
              src="/hero-parallax-layer-4.webp"
              alt=""
              class="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[160%] max-w-[1000px] object-contain"
              style={{
                transform: `translate(${getLayerOffset(0.2).x}px, ${getLayerOffset(0.2).y}px)`,
              }}
            />
            {/* Foreground layers (1-3) */}
            <img
              src="/hero-parallax-layer-3.webp"
              alt=""
              class="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[160%] max-w-[1000px] object-contain"
              style={{
                transform: `translate(${getLayerOffset(0.5).x}px, ${getLayerOffset(0.5).y}px)`,
              }}
            />
            <img
              src="/hero-parallax-layer-2.webp"
              alt=""
              class="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[160%] max-w-[1000px] object-contain"
              style={{
                transform: `translate(${getLayerOffset(0.75).x}px, ${getLayerOffset(0.75).y}px)`,
              }}
            />
            <img
              ref={(el) => {
                const logSize = () => {
                  const rect = el.getBoundingClientRect();
                  console.log('Mobile Hero Layer 1:', {
                    width: rect.width,
                    height: rect.height,
                    top: rect.top,
                    right: rect.right,
                    left: rect.left,
                    bottom: rect.bottom,
                    viewportWidth: window.innerWidth,
                    viewportHeight: window.innerHeight,
                  });
                };
                el.onload = logSize;
                window.addEventListener('resize', logSize);
              }}
              src="/hero-parallax-layer-1.webp"
              alt="FreeSpeech AAC Tiles"
              class="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[160%] max-w-[1000px] object-contain"
              style={{
                transform: `translate(${getLayerOffset(1).x}px, ${getLayerOffset(1).y}px)`,
              }}
            />
          </div>

          <div class="relative px-6 md:px-12">
            <div class="flex items-start pt-8 md:pt-32 pb-16 md:pb-24">
              {/* Left Content */}
              <div class="relative z-10 flex flex-col py-8 md:max-w-[620px] md:py-0">
                <h1 class="text-5xl font-bold tracking-tight text-gray-900 sm:text-6xl lg:text-7xl">
                  Give Everyone
                  <br />a Voice
                </h1>
                <p class="mt-8 max-w-[520px] text-xl leading-relaxed text-gray-600 lg:text-2xl">
                  A completely free, open-source Augmentative and Alternative
                  Communication (AAC) tool with natural-sounding AI voices.
                  Empowering communication for everyone, everywhere.
                </p>

                {/* Action Buttons */}
                <div class="mt-12 flex flex-wrap items-center gap-4">
                  <A
                    href="/register"
                    class="rounded-full bg-gradient-to-r from-blue-600 to-blue-500 px-10 py-4 text-lg font-semibold text-white shadow-[0_4px_14px_rgba(59,130,246,0.4)] transition-all hover:shadow-[0_6px_20px_rgba(59,130,246,0.5)] hover:brightness-105"
                  >
                    Get Started Free
                  </A>
                  <a
                    href="https://github.com/merkie/freespeech"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="rounded-full border-2 border-blue-500 px-10 py-4 text-lg font-semibold text-blue-600 transition-all hover:bg-blue-50"
                  >
                    GitHub
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Hero Image - Parallax Layers */}
          <div class="pointer-events-none absolute top-0 right-0 hidden h-full w-[60%] md:block">
            {/* Background layers (4-5) - subtle movement */}
            <img
              src="/hero-parallax-layer-5.webp"
              alt=""
              class="absolute top-[-7%] left-[-50px] w-[155%] min-w-[1100px] max-w-none object-contain"
              style={{
                transform: `translate(${getLayerOffset(0.1).x}px, ${getLayerOffset(0.1).y}px)`,
              }}
            />
            <img
              src="/hero-parallax-layer-4.webp"
              alt=""
              class="absolute top-[-7%] left-[-50px] w-[155%] min-w-[1100px] max-w-none object-contain"
              style={{
                transform: `translate(${getLayerOffset(0.2).x}px, ${getLayerOffset(0.2).y}px)`,
              }}
            />
            {/* Foreground layers (1-3) - more pronounced movement */}
            <img
              src="/hero-parallax-layer-3.webp"
              alt=""
              class="absolute top-[-7%] left-[-50px] w-[155%] min-w-[1100px] max-w-none object-contain"
              style={{
                transform: `translate(${getLayerOffset(0.5).x}px, ${getLayerOffset(0.5).y}px)`,
              }}
            />
            <img
              src="/hero-parallax-layer-2.webp"
              alt=""
              class="absolute top-[-7%] left-[-50px] w-[155%] min-w-[1100px] max-w-none object-contain"
              style={{
                transform: `translate(${getLayerOffset(0.75).x}px, ${getLayerOffset(0.75).y}px)`,
              }}
            />
            <img
              ref={(el) => {
                const logSize = () => {
                  const rect = el.getBoundingClientRect();
                  console.log('Hero Layer 1:', {
                    width: rect.width,
                    height: rect.height,
                    top: rect.top,
                    right: rect.right,
                    left: rect.left,
                    bottom: rect.bottom,
                    viewportWidth: window.innerWidth,
                    viewportHeight: window.innerHeight,
                  });
                };
                el.onload = logSize;
                window.addEventListener('resize', logSize);
              }}
              src="/hero-parallax-layer-1.webp"
              alt="FreeSpeech AAC Tiles"
              class="absolute top-[-7%] left-[-50px] w-[155%] min-w-[1100px] max-w-none object-contain"
              style={{
                transform: `translate(${getLayerOffset(1).x}px, ${getLayerOffset(1).y}px)`,
              }}
            />
          </div>

        </section>

        {/* Features Section */}
        <section class="relative bg-gray-50 py-24 lg:py-32">
          <div class="px-6 lg:px-12">
            <div class="mb-16 text-center">
              <h2 class="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
                Why FreeSpeech?
              </h2>
              <p class="mx-auto mt-4 max-w-2xl text-xl text-gray-600">
                Built with love for the AAC community. No paywalls, no
                subscriptions, just communication.
              </p>
            </div>

            <div class="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {/* Feature 1 */}
              <div class="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
                <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                  <svg
                    class="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="2"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                    />
                  </svg>
                </div>
                <h3 class="mt-6 text-xl font-semibold text-gray-900">
                  Free Forever
                </h3>
                <p class="mt-3 leading-relaxed text-gray-600">
                  No subscriptions, no premium tiers. FreeSpeech is completely
                  free and supported by community donations.
                </p>
              </div>

              {/* Feature 2 */}
              <div class="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
                <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 text-green-600">
                  <svg
                    class="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="2"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z"
                    />
                  </svg>
                </div>
                <h3 class="mt-6 text-xl font-semibold text-gray-900">
                  AI-Powered Voices
                </h3>
                <p class="mt-3 leading-relaxed text-gray-600">
                  Ultra-realistic text-to-speech powered by ElevenLabs. Natural
                  voices with emotion and inflection.
                </p>
              </div>

              {/* Feature 3 */}
              <div class="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
                <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 text-purple-600">
                  <svg
                    class="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="2"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3"
                    />
                  </svg>
                </div>
                <h3 class="mt-6 text-xl font-semibold text-gray-900">
                  Works Everywhere
                </h3>
                <p class="mt-3 leading-relaxed text-gray-600">
                  Use on any device—iOS, Android, Mac, Windows, or Linux. Your
                  boards sync seamlessly across all platforms.
                </p>
              </div>

              {/* Feature 4 */}
              <div class="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
                <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
                  <svg
                    class="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="2"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128Zm0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1 1.622-3.395m3.42 3.42a15.995 15.995 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a15.996 15.996 0 0 0-4.649 4.763m3.42 3.42a6.776 6.776 0 0 0-3.42-3.42"
                    />
                  </svg>
                </div>
                <h3 class="mt-6 text-xl font-semibold text-gray-900">
                  Fully Customizable
                </h3>
                <p class="mt-3 leading-relaxed text-gray-600">
                  Create custom boards with your own images, colors, and
                  layouts. Tailor the experience to individual needs.
                </p>
              </div>

              {/* Feature 5 */}
              <div class="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
                <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-pink-100 text-pink-600">
                  <svg
                    class="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="2"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z"
                    />
                  </svg>
                </div>
                <h3 class="mt-6 text-xl font-semibold text-gray-900">
                  Easy Sharing
                </h3>
                <p class="mt-3 leading-relaxed text-gray-600">
                  Import and export boards in OBF/OBZ formats. Share your
                  creations with other AAC users instantly.
                </p>
              </div>

              {/* Feature 6 */}
              <div class="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
                <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-100 text-cyan-600">
                  <svg
                    class="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="2"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5"
                    />
                  </svg>
                </div>
                <h3 class="mt-6 text-xl font-semibold text-gray-900">
                  Open Source
                </h3>
                <p class="mt-3 leading-relaxed text-gray-600">
                  100% open source and transparent. Community-driven development
                  means constant improvements.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section class="bg-white py-24 lg:py-32">
          <div class="px-6 text-center lg:px-12">
            <h2 class="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              Ready to get started?
            </h2>
            <p class="mx-auto mt-6 max-w-2xl text-xl text-gray-600">
              Join thousands of users who trust FreeSpeech for their daily
              communication needs.
            </p>
            <div class="mt-10 flex flex-wrap items-center justify-center gap-4">
              <A
                href="/register"
                class="rounded-full bg-gradient-to-r from-blue-600 to-blue-500 px-10 py-4 text-lg font-semibold text-white shadow-[0_4px_14px_rgba(59,130,246,0.4)] transition-all hover:shadow-[0_6px_20px_rgba(59,130,246,0.5)] hover:brightness-105"
              >
                Create Free Account
              </A>
              <a
                href="https://github.com/merkie/freespeech"
                target="_blank"
                rel="noopener noreferrer"
                class="rounded-full border-2 border-gray-300 px-10 py-4 text-lg font-semibold text-gray-700 transition-all hover:border-gray-400 hover:bg-gray-50"
              >
                View on GitHub
              </a>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer class="border-t border-gray-200 bg-gray-50 py-12">
          <div class="px-6 lg:px-12">
            <div class="flex flex-col items-center justify-between gap-6 sm:flex-row">
              <div class="flex items-center gap-3">
                <img
                  src="/logo.png"
                  class="h-8 w-8"
                  alt="FreeSpeech AAC Logo"
                />
                <span class="font-semibold text-gray-900">FreeSpeech AAC</span>
              </div>
              <div class="flex items-center gap-6 text-sm text-gray-600">
                <a
                  href="https://github.com/merkie/freespeech"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="hover:text-gray-900"
                >
                  GitHub
                </a>
                <a
                  href="https://github.com/sponsors/Merkie"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="hover:text-gray-900"
                >
                  Sponsor
                </a>
                <A href="/tos" class="hover:text-gray-900">
                  Terms
                </A>
                <A href="/privacy" class="hover:text-gray-900">
                  Privacy
                </A>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default Page;
