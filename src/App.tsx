import { lazy, Suspense, type ReactNode } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { X } from 'lucide-react';
import { ToastProvider } from '@mister-guiiug/dev-pwa-config/react/toast';
import { IconsProvider } from '@mister-guiiug/dev-pwa-config/react/icons-context';
import { LabelsProvider } from '@mister-guiiug/dev-pwa-config/react/labels';
import { lucideIconSet } from '@mister-guiiug/dev-pwa-config/react/icons-lucide';
import { AppFooter } from '@mister-guiiug/dev-pwa-config/react/app-footer';
import { repoUrl } from '@mister-guiiug/dev-pwa-config/apps-catalog';
import { AuthProvider } from './auth/AuthContext.tsx';
import { AuthGate } from './auth/AuthGate.tsx';
import { useAuth } from './auth/useAuth.ts';
import { useI18n } from './i18n/index.ts';
import { ConfirmProvider } from './components/ui/ConfirmProvider.tsx';
import { Header } from './components/Header.tsx';
import { BottomNav } from './components/BottomNav.tsx';
import { InstallPrompt } from './components/InstallPrompt.tsx';
import { OfflineBanner } from './components/OfflineBanner.tsx';
import { UpdatePrompt } from './components/UpdatePrompt.tsx';
import { FullScreenSpinner } from './components/Spinner.tsx';
import { PlanningView } from './features/planning/PlanningView.tsx';

const MyPlanningView = lazy(() =>
  import('./features/planning/MyPlanningView.tsx').then(m => ({
    default: m.MyPlanningView,
  }))
);
const AdminPanel = lazy(() =>
  import('./features/admin/AdminPanel.tsx').then(m => ({
    default: m.AdminPanel,
  }))
);
const AllCounters = lazy(() =>
  import('./features/admin/AllCounters.tsx').then(m => ({
    default: m.AllCounters,
  }))
);
const SwapBoard = lazy(() =>
  import('./features/swaps/SwapBoard.tsx').then(m => ({ default: m.SwapBoard }))
);
const ProfilePage = lazy(() =>
  import('./features/profile/ProfilePage.tsx').then(m => ({
    default: m.ProfilePage,
  }))
);

function AdminRoute({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/* Les composants du socle (croix du toast…) dessinent leurs icônes via le
   contrat de rôles : on branche lucide, le jeu d'icônes de l'app, plutôt que
   de laisser cohabiter deux langages visuels. */
const DWC_ICONS = lucideIconSet({ close: X });

export default function App() {
  const { t, locale } = useI18n();
  return (
    <IconsProvider icons={DWC_ICONS}>
      {/* Les libellés propres aux composants du socle (« Page actuelle » de la
          barre d'onglets, « Fermer » d'un toast, « Confirmer »…) vivent dans
          leur propre dictionnaire, que `createI18n` ne peut pas atteindre.
          Sans ce pont ils restent en FRANÇAIS quand l'utilisateur passe
          l'interface en anglais. */}
      <LabelsProvider locale={locale}>
        <ToastProvider>
          <ConfirmProvider>
            <AuthProvider>
              {/* UN SEUL bandeau réseau pour toute l'application, et AVANT la
                  porte d'accès : se connecter est déjà un appel réseau, et
                  l'écran de connexion ne disait rien d'autre qu'une erreur
                  d'authentification quand c'était le réseau qui manquait.
                  Placé ici, il couvre AUSSI l'attente d'approbation, le défi
                  2FA et l'application elle-même.

                  EN HAUT, ET DANS LE FLUX. Le bas de l'écran est déjà pris sur
                  trois niveaux (BottomNav z-30, InstallPrompt z-40,
                  UpdatePrompt z-50) : un quatrième bandeau y passerait sous ou
                  par-dessus les autres — un défaut qu'aucun test ne verrait. */}
              <OfflineBanner />
              <AuthGate>
                <HashRouter>
                  <div className="min-h-dvh bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
                    <Header />
                    <main className="pb-24">
                      <Suspense
                        fallback={
                          <FullScreenSpinner label={t('common.loading')} />
                        }
                      >
                        <Routes>
                          <Route path="/" element={<PlanningView />} />
                          <Route
                            path="/mon-planning"
                            element={<MyPlanningView />}
                          />
                          <Route path="/echanges" element={<SwapBoard />} />
                          <Route path="/profil" element={<ProfilePage />} />
                          <Route
                            path="/compteurs"
                            element={
                              <AdminRoute>
                                <AllCounters />
                              </AdminRoute>
                            }
                          />
                          <Route
                            path="/admin"
                            element={
                              <AdminRoute>
                                <AdminPanel />
                              </AdminRoute>
                            }
                          />
                          <Route
                            path="*"
                            element={<Navigate to="/" replace />}
                          />
                        </Routes>
                      </Suspense>

                      {/* HORS des routes : le code source et le soutien sont
                          ainsi sur le premier écran comme sur le Profil — la
                          règle famille. Écrit dans un `element={…}`, ce pied
                          de page ne vaudrait que pour une route. Il est DANS
                          `<main>` parce que la barre basse est fixe et que
                          c'est le `pb-24` de `<main>` qui lui réserve sa
                          place. */}
                      <AppFooter
                        className="mt-8 justify-center px-4"
                        repoUrl={repoUrl('mister-doc')}
                      />
                    </main>
                    <BottomNav />
                  </div>
                </HashRouter>
              </AuthGate>
              <InstallPrompt />
              <UpdatePrompt />
            </AuthProvider>
          </ConfirmProvider>
        </ToastProvider>
      </LabelsProvider>
    </IconsProvider>
  );
}
