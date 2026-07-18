import { useState } from 'react';
import { ShieldCheck, LogOut, KeyRound } from 'lucide-react';
import { useAuth } from './useAuth.ts';
import { Button } from '../components/ui/Button.tsx';

/**
 * Étape de vérification en deux étapes au login (comptes ayant activé la 2FA,
 * session encore aal1). Deux voies : le code TOTP à 6 chiffres, ou un CODE DE
 * SECOURS (récupération si l'authentificateur est perdu). Échappatoire déconnexion.
 */
export function MfaChallenge() {
  const { verifyMfa, recoverMfa, signOut } = useAuth();
  const [mode, setMode] = useState<'totp' | 'recovery'>('totp');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isTotp = mode === 'totp';
  const ready = isTotp ? code.trim().length >= 6 : code.trim().length >= 8;

  function switchMode(next: 'totp' | 'recovery') {
    setMode(next);
    setCode('');
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setError(null);
    setBusy(true);
    const res = isTotp ? await verifyMfa(code) : await recoverMfa(code);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      setCode('');
    }
  }

  return (
    <div className="min-h-dvh grid place-items-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-800/80">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="grid size-12 place-items-center rounded-xl bg-teal-600 text-white">
            {isTotp ? (
              <ShieldCheck className="size-6" />
            ) : (
              <KeyRound className="size-6" />
            )}
          </div>
          <h1 className="text-xl font-bold">
            {isTotp ? 'Vérification en deux étapes' : 'Code de secours'}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isTotp
              ? "Saisissez le code à 6 chiffres affiché dans votre application d'authentification."
              : "Saisissez l'un de vos codes de secours à usage unique. Votre double authentification sera désactivée."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-600 dark:text-slate-300">
              {isTotp ? 'Code à 6 chiffres' : 'Code de secours'}
            </span>
            {isTotp ? (
              <input
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                placeholder="123456"
                autoFocus
                aria-invalid={error ? true : undefined}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-center text-lg tracking-[0.4em] tabular-nums outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 dark:border-slate-600 dark:bg-slate-900"
              />
            ) : (
              <input
                value={code}
                onChange={e => setCode(e.target.value.slice(0, 12))}
                autoComplete="one-time-code"
                placeholder="xxxx-xxxx"
                autoFocus
                aria-invalid={error ? true : undefined}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-center text-lg tracking-[0.2em] outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 dark:border-slate-600 dark:bg-slate-900"
              />
            )}
          </label>

          {error && (
            <p
              role="alert"
              className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300"
            >
              {error}
            </p>
          )}

          <Button
            type="submit"
            loading={busy}
            disabled={!ready}
            className="mt-1 w-full py-2.5"
          >
            {isTotp ? 'Vérifier' : 'Récupérer mon accès'}
          </Button>
        </form>

        <div className="mt-4 text-center text-xs text-slate-400">
          {isTotp ? (
            <button
              type="button"
              onClick={() => switchMode('recovery')}
              className="underline hover:text-slate-600 dark:hover:text-slate-200"
            >
              Authentificateur perdu ? Utiliser un code de secours
            </button>
          ) : (
            <button
              type="button"
              onClick={() => switchMode('totp')}
              className="underline hover:text-slate-600 dark:hover:text-slate-200"
            >
              Revenir au code à 6 chiffres
            </button>
          )}
        </div>

        <button
          onClick={() => void signOut()}
          className="mx-auto mt-3 flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <LogOut className="size-3.5" /> Se déconnecter
        </button>
      </div>
    </div>
  );
}
