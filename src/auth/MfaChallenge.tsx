import { useState } from 'react';
import { ShieldCheck, LogOut } from 'lucide-react';
import { useAuth } from './useAuth.ts';
import { Button } from '../components/ui/Button.tsx';

/**
 * Étape de vérification en deux étapes au login. S'affiche uniquement pour les
 * comptes ayant activé la 2FA (facteur TOTP vérifié, session encore aal1). Une
 * échappatoire « Se déconnecter » évite tout blocage définitif.
 */
export function MfaChallenge() {
  const { verifyMfa, signOut } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (code.trim().length < 6) return;
    setError(null);
    setBusy(true);
    const res = await verifyMfa(code);
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
            <ShieldCheck className="size-6" />
          </div>
          <h1 className="text-xl font-bold">Vérification en deux étapes</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Saisissez le code à 6 chiffres affiché dans votre application
            d'authentification.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-600 dark:text-slate-300">
              Code à 6 chiffres
            </span>
            <input
              value={code}
              onChange={e =>
                setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
              }
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              placeholder="123456"
              autoFocus
              aria-invalid={error ? true : undefined}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-center text-lg tracking-[0.4em] tabular-nums outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 dark:border-slate-600 dark:bg-slate-900"
            />
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
            disabled={code.trim().length < 6}
            className="mt-1 w-full py-2.5"
          >
            Vérifier
          </Button>
        </form>

        <button
          onClick={() => void signOut()}
          className="mx-auto mt-4 flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <LogOut className="size-3.5" /> Se déconnecter
        </button>
      </div>
    </div>
  );
}
