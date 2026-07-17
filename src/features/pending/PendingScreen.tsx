import { useState } from 'react';
import { Clock, LogOut, KeyRound, Loader2, Trash2 } from 'lucide-react';
import { useAuth } from '../../auth/useAuth.ts';
import { claimAdmin, deleteMyAccount } from '../../backend/doctors.ts';
import { useConfirm } from '../../components/ui/confirmContext.ts';

export function PendingScreen() {
  const { doctor, signOut, refreshDoctor } = useAuth();
  const confirm = useConfirm();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (
      !(await confirm({
        message:
          'Supprimer définitivement votre demande d’accès ? Vous pourrez vous réinscrire avec la même adresse.',
        danger: true,
        confirmLabel: 'Supprimer',
      }))
    )
      return;
    setError(null);
    setDeleting(true);
    try {
      await deleteMyAccount();
      await signOut();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
      setDeleting(false);
    }
  }

  async function handleClaim(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await claimAdmin(code.trim());
      await refreshDoctor();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-lg dark:border-slate-700 dark:bg-slate-800">
        <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/40">
          <Clock className="size-7" />
        </div>
        <h1 className="text-lg font-bold">Compte en attente de validation</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Bonjour {doctor?.name}. Votre compte a bien été créé mais doit être
          approuvé par un administrateur avant d'accéder au planning.
        </p>

        <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-700">
          {!showCode ? (
            <button
              onClick={() => setShowCode(true)}
              className="flex w-full items-center justify-center gap-2 text-sm font-medium text-teal-600 hover:underline"
            >
              <KeyRound className="size-4" />
              J'ai un code d'administrateur
            </button>
          ) : (
            <form onSubmit={handleClaim} className="flex flex-col gap-2">
              <p className="text-left text-xs text-slate-500 dark:text-slate-400">
                Premier administrateur : saisissez le code de bootstrap fourni
                lors de l'installation.
              </p>
              <div className="flex gap-2">
                <input
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  placeholder="code de bootstrap"
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 dark:border-slate-600 dark:bg-slate-900"
                />
                <button
                  type="submit"
                  disabled={busy || !code.trim()}
                  className="flex items-center gap-1 rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {busy && <Loader2 className="size-4 animate-spin" />}
                  Valider
                </button>
              </div>
              {error && (
                <p className="text-left text-xs text-red-600">{error}</p>
              )}
            </form>
          )}
        </div>

        <div className="mt-6 flex flex-col items-center gap-3">
          <button
            onClick={() => void signOut()}
            className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600"
          >
            <LogOut className="size-4" /> Se déconnecter
          </button>
          <button
            onClick={() => void handleDelete()}
            disabled={deleting}
            className="flex items-center gap-1 text-sm font-medium text-red-500 hover:text-red-600 disabled:opacity-60"
          >
            {deleting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
            Supprimer ma demande
          </button>
        </div>
      </div>
    </div>
  );
}
