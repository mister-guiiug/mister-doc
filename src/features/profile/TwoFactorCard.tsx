import { useEffect, useRef, useState } from 'react';
import { ShieldCheck, ShieldAlert, Check, X } from 'lucide-react';
import { useToast } from '../../components/Toast.tsx';
import { useConfirm } from '../../components/ui/confirmContext.ts';
import { Button } from '../../components/ui/Button.tsx';
import { SectionCard } from '../../components/ui/SectionCard.tsx';
import {
  cancelTotpEnrollment,
  confirmTotpEnrollment,
  disableTotp,
  enrollTotp,
  verifiedTotpFactorId,
  type TotpEnrollment,
} from '../../backend/mfa.ts';

type Status = 'loading' | 'on' | 'off' | 'error';

/**
 * Double authentification (2FA / TOTP) dans le profil. Opt-in : le médecin
 * scanne le QR code dans son application d'authentification, confirme un code,
 * puis chaque connexion demandera ce code. Désactivation avec confirmation.
 */
export function TwoFactorCard() {
  const toast = useToast();
  const confirm = useConfirm();
  const [status, setStatus] = useState<Status>('loading');
  const [enroll, setEnroll] = useState<TotpEnrollment | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Évite un setState après démontage (les appels réseau sont asynchrones).
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  async function refresh() {
    try {
      const id = await verifiedTotpFactorId();
      if (alive.current) setStatus(id ? 'on' : 'off');
    } catch {
      if (alive.current) setStatus('error');
    }
  }
  useEffect(() => {
    void refresh();
  }, []);

  async function startEnroll() {
    setBusy(true);
    setErr(null);
    try {
      const e = await enrollTotp();
      if (alive.current) setEnroll(e);
    } catch (e) {
      if (alive.current) setErr(e instanceof Error ? e.message : 'Erreur');
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  async function confirmEnroll(ev: React.FormEvent) {
    ev.preventDefault();
    if (!enroll || code.trim().length < 6) return;
    setBusy(true);
    setErr(null);
    try {
      await confirmTotpEnrollment(enroll.factorId, code);
      if (!alive.current) return;
      setEnroll(null);
      setCode('');
      toast.success('Double authentification activée.');
      await refresh();
    } catch (e) {
      if (alive.current) {
        setErr(e instanceof Error ? e.message : 'Erreur');
        setCode('');
      }
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  async function cancelEnroll() {
    const pending = enroll;
    setEnroll(null);
    setCode('');
    setErr(null);
    if (pending) void cancelTotpEnrollment(pending.factorId);
  }

  async function disable() {
    const ok = await confirm({
      title: 'Désactiver la double authentification ?',
      message:
        'Votre compte ne sera plus protégé que par le mot de passe. Vous pourrez la réactiver à tout moment.',
      confirmLabel: 'Désactiver',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await disableTotp();
      toast.success('Double authentification désactivée.');
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  return (
    <SectionCard
      icon={<ShieldCheck className="size-4" />}
      title="Double authentification"
      desc="Un code à 6 chiffres en plus du mot de passe, à chaque connexion"
    >
      {status === 'loading' && (
        <p className="text-sm text-slate-500 dark:text-slate-400">Chargement…</p>
      )}

      {status === 'error' && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          État indisponible (hors ligne ?). Réessayez une fois connecté.
        </p>
      )}

      {/* Activée */}
      {status === 'on' && !enroll && (
        <div className="flex flex-col gap-3">
          <p className="flex items-center gap-2 rounded-lg bg-teal-50 px-3 py-2 text-sm font-medium text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">
            <ShieldCheck className="size-4 shrink-0" /> Activée — un code vous sera
            demandé à chaque connexion.
          </p>
          <Button
            variant="dangerGhost"
            className="w-full py-2.5"
            loading={busy}
            onClick={() => void disable()}
          >
            Désactiver
          </Button>
        </div>
      )}

      {/* Désactivée, pas d'enrôlement en cours */}
      {status === 'off' && !enroll && (
        <div className="flex flex-col gap-3">
          <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <ShieldAlert className="size-4 shrink-0 text-amber-500" /> Recommandée
            pour protéger l'accès au planning.
          </p>
          <Button
            className="w-full py-2.5"
            loading={busy}
            onClick={() => void startEnroll()}
          >
            <ShieldCheck className="size-4" /> Activer
          </Button>
        </div>
      )}

      {/* Enrôlement en cours : QR + secret + confirmation du code */}
      {enroll && (
        <form onSubmit={confirmEnroll} className="flex flex-col gap-3">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
            <li>
              Scannez ce QR code dans votre application d'authentification (Google
              Authenticator, Authy…).
            </li>
            <li>Saisissez le code à 6 chiffres qu'elle affiche.</li>
          </ol>
          <div className="mx-auto rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-700">
            {/* data:image/svg+xml fourni par Supabase — autorisé par la CSP img-src data:. */}
            <img
              src={enroll.qrCode}
              alt="QR code de configuration"
              width={176}
              height={176}
              className="size-44"
            />
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-center dark:bg-slate-800">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Ou saisie manuelle :
            </span>
            <p className="mt-0.5 break-all font-mono text-xs font-medium">
              {enroll.secret}
            </p>
          </div>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-600 dark:text-slate-300">
              Code à 6 chiffres
            </span>
            <input
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              placeholder="123456"
              autoFocus
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-center text-lg tracking-[0.3em] tabular-nums outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 dark:border-slate-600 dark:bg-slate-900"
            />
          </label>

          {err && (
            <p
              role="alert"
              className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300"
            >
              {err}
            </p>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              className="flex-1 py-2.5"
              onClick={() => void cancelEnroll()}
            >
              <X className="size-4" /> Annuler
            </Button>
            <Button
              type="submit"
              className="flex-1 py-2.5"
              loading={busy}
              disabled={code.trim().length < 6}
            >
              <Check className="size-4" /> Vérifier
            </Button>
          </div>
        </form>
      )}
    </SectionCard>
  );
}
