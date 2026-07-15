import { lazy, Suspense, type ReactNode } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext.tsx';
import { AuthGate } from './auth/AuthGate.tsx';
import { useAuth } from './auth/useAuth.ts';
import { ToastProvider } from './components/Toast.tsx';
import { Header } from './components/Header.tsx';
import { BottomNav } from './components/BottomNav.tsx';
import { InstallPrompt } from './components/InstallPrompt.tsx';
import { FullScreenSpinner } from './components/Spinner.tsx';
import { PlanningView } from './features/planning/PlanningView.tsx';

const MyPlanningView = lazy(() =>
  import('./features/planning/MyPlanningView.tsx').then(m => ({
    default: m.MyPlanningView,
  }))
);
const AdminPanel = lazy(() =>
  import('./features/admin/AdminPanel.tsx').then(m => ({ default: m.AdminPanel }))
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

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AuthGate>
          <HashRouter>
            <div className="min-h-dvh bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
              <Header />
              <main className="pb-24">
                <Suspense fallback={<FullScreenSpinner label="Chargement…" />}>
                  <Routes>
                    <Route path="/" element={<PlanningView />} />
                    <Route path="/mon-planning" element={<MyPlanningView />} />
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
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Suspense>
              </main>
              <BottomNav />
            </div>
          </HashRouter>
        </AuthGate>
        <InstallPrompt />
      </AuthProvider>
    </ToastProvider>
  );
}
