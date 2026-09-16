import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  installErrorReporter,
  initSentry,
} from '@mister-guiiug/dev-pwa-config/react/observability';
import { ThemeProvider } from '@mister-guiiug/dev-pwa-config/react/theme-provider';
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
  // La version applicative, pour qu’une erreur soit rattachée à un build
  // précis : sans elle, toutes les traces se mélangent dans un seul tas.
  release: __APP_VERSION__,
  // `loader` REND L’IMPORT ANALYSABLE PAR VITE, et c’est ce qui permet au
  // `manualChunks` de le ranger dans son propre morceau. Sans lui, le socle
  // retombe sur un spécificateur volontairement non analysable — nécessaire
  // tant que la peer n’est pas installée, inutile maintenant qu’elle l’est.
  //
  // Rien ne part tant qu’aucun DSN n’est posé : `initSentry` rend `null`
  // AVANT l’import. Et le morceau est hors du précache du service worker,
  // sans quoi il serait téléchargé quand même (cf. vite.config.ts).
  loader: () => import('@sentry/react'),
});

const root = document.getElementById('root');
if (!root) throw new Error('Élément #root introuvable');

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      {/* Avant React, le thème est posé par le script anti-FOUC injecté au
          build (pwaSeoPlugin themeBoot) ; ThemeProvider prend ensuite le
          relais et devient le SEUL écrivain de `data-theme` : l'écran
          Apparence et toute autre commande passent par son contexte, jamais
          par une seconde instance de `useTheme`. Pas d'`appId` : aucune
          palette `--dwc-*` n'est peinte, index.css garde la main.
          `legacyKeys` doit rester aligné sur l'option `themeBoot` de
          vite.config.ts. */}
      <ThemeProvider legacyKeys={['mister-doc:theme']}>
        <I18nProvider>
          <App />
        </I18nProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>
);
