import type { ReactNode } from 'react';
import { LogOut } from 'lucide-react';
import { useAuth } from './useAuth.ts';
import { useI18n } from '../i18n/index.ts';
import { LoginPage } from './LoginPage.tsx';
import { MfaChallenge } from './MfaChallenge.tsx';
import { FullScreenSpinner } from '../components/Spinner.tsx';
import { PendingScreen } from '../features/pending/PendingScreen.tsx';

/**
 * Contrôle d'accès : chargement → connexion → (défi 2FA) → (fiche médecin) →
 * attente d'approbation → application.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { loading, session, doctor, signOut, mfaRequired } = useAuth();
  const { t } = useI18n();

  if (loading) return <FullScreenSpinner label={t('common.loading')} />;
  if (!session) return <LoginPage />;
  // 2FA activée : bloquer l'accès tant que l'étape TOTP n'est pas franchie.
  if (mfaRequired) return <MfaChallenge />;

  if (!doctor) {
    return (
      <div className="grid min-h-dvh place-items-center p-4 text-center">
        <div className="max-w-sm">
          <p className="text-slate-600 dark:text-slate-300">
            {t('authGate.cannotLoadDoctor')}
          </p>
          <button
            onClick={() => void signOut()}
            className="mx-auto mt-4 flex items-center gap-1 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white"
          >
            <LogOut className="size-4" /> {t('authGate.signOut')}
          </button>
        </div>
      </div>
    );
  }

  if (!doctor.approved) return <PendingScreen />;

  return <>{children}</>;
}
