import './index.css';

import { Route, Router } from '@solidjs/router';
import { render } from 'solid-js/web';
import PreventZoom from '@/components/PreventZoom';
import { TooltipProvider } from '@/hooks/useTooltip';
import { registerServiceWorker } from '@/lib/sw-update';

// --- Direct Component Imports ---

import LoginEmailPage from './routes/(auth)/login/email/page.tsx';
import ForgotPasswordPage from './routes/(auth)/login/forgot-password/page.tsx';
// Auth Routes
import LoginPage from './routes/(auth)/login/page.tsx';
import ResetPasswordPage from './routes/(auth)/login/reset-password/page.tsx';
import GoogleOauthPage from './routes/(auth)/oauth/google/page.tsx';
import RegisterEmailPage from './routes/(auth)/register/email/page.tsx';
import RegisterPage from './routes/(auth)/register/page.tsx';
import DashboardLayout from './routes/app/dashboard/layout.tsx';
import ProfilePage from './routes/app/dashboard/profile/page.tsx';
import ProjectsPage from './routes/app/dashboard/projects/page.tsx';
import SettingsAccessControlsPage from './routes/app/dashboard/settings/access-controls/page.tsx';
import SettingsAppearancePage from './routes/app/dashboard/settings/appearance/page.tsx';
import SettingsBehaviorPage from './routes/app/dashboard/settings/behavior/page.tsx';
import SettingsPage from './routes/app/dashboard/settings/page.tsx';
import SettingsVoicePage from './routes/app/dashboard/settings/voice/page.tsx';
import TemplatesPage from './routes/app/dashboard/templates/page.tsx';
// Application Layouts and Pages
import AppLayout from './routes/app/layout.tsx';
import AppEntryPage from './routes/app/page.tsx';
import LegacyPageRedirect from './routes/app/project/[project_id]/[page_id].tsx';
import AppProjectPage from './routes/app/project/[project_id]/page.tsx';
import ThumbnailPage from './routes/app/project/[project_id]/thumbnail.tsx';
// Root Layouts
import Layout from './routes/layout.tsx';
import NotFound from './routes/NotFound.tsx';
import HomePage from './routes/page.tsx';

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
			<Router>
				<Route path="/" component={Layout}>
					<Route path="/" component={HomePage} />
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
		</>
	),
	wrapper,
);

registerServiceWorker();
