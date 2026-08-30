import { lazy, Suspense, type ReactNode } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { X } from 'lucide-react';
import { ToastProvider } from '@mister-guiiug/dev-wpa-config/react/toast';
import { IconsProvider } from '@mister-guiiug/dev-wpa-config/react/icons-context';
import { LabelsProvider } from '@mister-guiiug/dev-wpa-config/react/labels';
import { lucideIconSet } from '@mister-guiiug/dev-wpa-config/react/icons-lucide';
import { AuthProvider } from './auth/AuthContext.tsx';
import { AuthGate } from './auth/AuthGate.tsx';
import { useAuth } from './auth/useAuth.ts';
import { useI18n } from './i18n/index.ts';
import { ConfirmProvider } from './components/ui/ConfirmProvider.tsx';
import { Header } from './components/Header.tsx';
import { BottomNav } from './components/BottomNav.tsx';
import { InstallPrompt } from './components/InstallPrompt.tsx';
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
