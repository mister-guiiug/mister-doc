import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { installErrorReporter } from '@mister-guiiug/dev-wpa-config/react/observability';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

// Capture les erreurs globales (window.onerror / unhandledrejection) dans le
// journal local partagé famille — avant tout rendu.
installErrorReporter();

const root = document.getElementById('root');
if (!root) throw new Error('Élément #root introuvable');

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
