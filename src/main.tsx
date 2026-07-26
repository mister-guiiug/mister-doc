import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  installErrorReporter,
  initSentry,
} from '@mister-guiiug/dev-wpa-config/react/observability';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { I18nProvider } from './i18n/index.ts';
import './index.css';

// Capture les erreurs globales (window.onerror / unhandledrejection) dans le
// journal local partagé famille — avant tout rendu.
installErrorReporter();
void initSentry({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
});

const root = document.getElementById('root');
if (!root) throw new Error('Élément #root introuvable');

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <I18nProvider>
        <App />
      </I18nProvider>
    </ErrorBoundary>
  </StrictMode>
);
