import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AuthProvider } from './auth/AuthContext.tsx';
import { AuthGate } from './auth/AuthGate.tsx';
import { useAuth } from './auth/useAuth.ts';
import { Header } from './components/Header.tsx';
import { InstallPrompt } from './components/InstallPrompt.tsx';
import { PlanningView } from './features/planning/PlanningView.tsx';
import { AdminPanel } from './features/admin/AdminPanel.tsx';
import { AllCounters } from './features/admin/AllCounters.tsx';

function AdminRoute({ children }: { children: ReactNode }) {
  const { doctor } = useAuth();
  if (!doctor?.is_admin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <AuthGate>
        <HashRouter>
          <div className="min-h-dvh bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
            <Header />
            <main className="pb-24">
              <Routes>
                <Route path="/" element={<PlanningView />} />
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
            </main>
          </div>
        </HashRouter>
      </AuthGate>
      <InstallPrompt />
    </AuthProvider>
  );
}
