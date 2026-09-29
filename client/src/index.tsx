import './index.css';

import { Route, Router } from '@solidjs/router';
import { lazy, Suspense } from 'solid-js';
import { render } from 'solid-js/web';
import PreventZoom from '@/components/PreventZoom';
import { TooltipProvider } from '@/hooks/useTooltip';
import { registerServiceWorker } from '@/lib/sw-update';

// --- Direct Component Imports ---

const LoginEmailPage = lazy(() => import('./routes/(auth)/login/email/page.tsx'));
const ForgotPasswordPage = lazy(() => import('./routes/(auth)/login/forgot-password/page.tsx'));
// Auth Routes
const LoginPage = lazy(() => import('./routes/(auth)/login/page.tsx'));
const ResetPasswordPage = lazy(() => import('./routes/(auth)/login/reset-password/page.tsx'));
const GoogleOauthPage = lazy(() => import('./routes/(auth)/oauth/google/page.tsx'));
const RegisterEmailPage = lazy(() => import('./routes/(auth)/register/email/page.tsx'));
const RegisterPage = lazy(() => import('./routes/(auth)/register/page.tsx'));
const DashboardLayout = lazy(() => import('./routes/app/dashboard/layout.tsx'));
const ProfilePage = lazy(() => import('./routes/app/dashboard/profile/page.tsx'));
const ProjectsPage = lazy(() => import('./routes/app/dashboard/projects/page.tsx'));
const SettingsAccessControlsPage = lazy(() => import('./routes/app/dashboard/settings/access-controls/page.tsx'));
const SettingsAppearancePage = lazy(() => import('./routes/app/dashboard/settings/appearance/page.tsx'));
const SettingsBehaviorPage = lazy(() => import('./routes/app/dashboard/settings/behavior/page.tsx'));
const SettingsPage = lazy(() => import('./routes/app/dashboard/settings/page.tsx'));
const SettingsVoicePage = lazy(() => import('./routes/app/dashboard/settings/voice/page.tsx'));
const TemplatesPage = lazy(() => import('./routes/app/dashboard/templates/page.tsx'));

// Application Layouts and Pages
import AppLayout from './routes/app/layout.tsx';
import AppEntryPage from './routes/app/page.tsx';
import LegacyPageRedirect from './routes/app/project/[project_id]/[page_id].tsx';
import AppProjectPage from './routes/app/project/[project_id]/page.tsx';

const ThumbnailPage = lazy(() => import('./routes/app/project/[project_id]/thumbnail.tsx'));

// Root Layouts
import Layout from './routes/layout.tsx';

const NotFound = lazy(() => import('./routes/NotFound.tsx'));
const HomePage = lazy(() => import('./routes/page.tsx'));

const PrivacyPage = lazy(() => import('./routes/(legal)/privacy/page'));
const TermsPage = lazy(() => import('./routes/(legal)/tos/page'));

// --- Application Entry Point ---

const wrapper = document.getElementById('root');

if (!wrapper) {
	// eslint-disable-next-line no-console
	console.error('Wrapper div not found');
	throw new Error('Wrapper div not found');
}

render(
	() => (
		<>
			<PreventZoom />
			<TooltipProvider />
			<Suspense fallback={<div class="fixed inset-0 grid place-items-center bg-zinc-900 text-white">Loading…</div>}>
				<Router>
					<Route path="/" component={Layout}>
						<Route path="/" component={HomePage} />
						<Route path="/privacy" component={PrivacyPage} />
						<Route path="/tos" component={TermsPage} />
						<Route path="/login" component={LoginPage} />
						<Route path="/login/email" component={LoginEmailPage} />
						<Route path="/login/forgot-password" component={ForgotPasswordPage} />
						<Route path="/login/reset-password" component={ResetPasswordPage} />
						<Route path="/register" component={RegisterPage} />
						<Route path="/register/email" component={RegisterEmailPage} />
						<Route path="/oauth/google" component={GoogleOauthPage} />
						<Route path="/app" component={AppLayout}>
							{/* Index route - handles /app entry point for PWA */}
							<Route path="/" component={AppEntryPage} />
							<Route path="/dashboard" component={DashboardLayout}>
								<Route path="/projects" component={ProjectsPage} />
								<Route path="/templates" component={TemplatesPage} />
								<Route path="/settings" component={SettingsPage} />
								<Route path="/settings/voice" component={SettingsVoicePage} />
								<Route path="/settings/behavior" component={SettingsBehaviorPage} />
								<Route path="/settings/appearance" component={SettingsAppearancePage} />
								<Route path="/settings/access-controls" component={SettingsAccessControlsPage} />
								<Route path="/profile" component={ProfilePage} />
							</Route>

							<Route path="/project/:project_id" component={AppProjectPage} />
							{/* Thumbnail route - chromeless tile grid for puppeteer screenshots */}
							<Route path="/project/:project_id/:page_id/thumbnail" component={ThumbnailPage} />
							{/* Legacy route - redirects old URLs with page_id to new format */}
							<Route path="/project/:project_id/:page_id" component={LegacyPageRedirect} />
						</Route>

						{/* 404 catch-all - redirect to home or dashboard */}
						<Route path="*" component={NotFound} />
					</Route>
				</Router>
			</Suspense>
		</>
	),
	wrapper,
);

registerServiceWorker();
