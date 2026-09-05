import { useEffect, useRef, useState } from 'react';
import { ShieldCheck, ShieldAlert, KeyRound } from 'lucide-react';
import { useToast } from '@mister-guiiug/dev-pwa-config/react/toast';
import { useConfirm } from '../../components/ui/confirmContext.ts';
import { Button } from '@mister-guiiug/dev-pwa-config/react/button';
import { SectionCard } from '../../components/ui/SectionCard.tsx';
import { useI18n } from '../../i18n/index.ts';
import { TwoFactorEnrollForm } from './TwoFactorEnrollForm.tsx';
import { TwoFactorRecoveryCodes } from './TwoFactorRecoveryCodes.tsx';
import {
  cancelTotpEnrollment,
  confirmTotpEnrollment,
  disableTotp,
  enrollTotp,
  generateRecoveryCodes,
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
  const { t } = useI18n();
  const [status, setStatus] = useState<Status>('loading');
  const [enroll, setEnroll] = useState<TotpEnrollment | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Codes de secours fraîchement générés (affichés UNE fois, jamais réaffichables).
  const [codes, setCodes] = useState<string[] | null>(null);
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
      if (alive.current)
        setErr(e instanceof Error ? e.message : t('common.error'));
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
      toast.success(t('twoFactor.enabled'));
      await refresh();
      // Génère les codes de secours dans la foulée (non bloquant si indisponible).
      try {
        const c = await generateRecoveryCodes();
        if (alive.current) setCodes(c);
      } catch {
        /* la 2FA est active ; les codes pourront être générés plus tard */
      }
    } catch (e) {
      if (alive.current) {
        setErr(e instanceof Error ? e.message : t('common.error'));
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

  async function makeCodes() {
    setBusy(true);
    try {
      const c = await generateRecoveryCodes();
      if (alive.current) setCodes(c);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('common.error'));
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  async function disable() {
    const ok = await confirm({
      title: t('twoFactor.disableConfirmTitle'),
      message: t('twoFactor.disableConfirmMsg'),
      confirmLabel: t('twoFactor.disableLabel'),
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await disableTotp();
      toast.success(t('twoFactor.disabled'));
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('common.error'));
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  return (
    <SectionCard
      icon={<ShieldCheck className="size-4" />}
      title={t('twoFactor.title')}
      desc={t('twoFactor.desc')}
    >
      {status === 'loading' && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t('twoFactor.loading')}
        </p>
      )}

      {status === 'error' && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          {t('twoFactor.unavailable')}
        </p>
      )}

      {/* Codes de secours fraîchement générés (affichés une seule fois) */}
      {codes && (
        <TwoFactorRecoveryCodes codes={codes} onSaved={() => setCodes(null)} />
      )}

      {/* Activée */}
      {status === 'on' && !enroll && !codes && (
        <div className="flex flex-col gap-3">
          <p className="flex items-center gap-2 rounded-lg bg-teal-50 px-3 py-2 text-sm font-medium text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">
            <ShieldCheck className="size-4 shrink-0" />{' '}
            {t('twoFactor.enabledInfo')}
          </p>
          <Button
            variant="secondary"
            className="w-full py-2.5"
            loading={busy}
            onClick={() => void makeCodes()}
          >
            <KeyRound className="size-4" /> {t('twoFactor.regenCodes')}
          </Button>
          <Button
            variant="outline"
            data-tone="danger"
            className="w-full py-2.5"
            loading={busy}
            onClick={() => void disable()}
          >
            {t('twoFactor.disable')}
          </Button>
        </div>
      )}

      {/* Désactivée, pas d'enrôlement en cours */}
      {status === 'off' && !enroll && (
        <div className="flex flex-col gap-3">
          <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <ShieldAlert className="size-4 shrink-0 text-amber-500" />{' '}
            {t('twoFactor.recommend')}
          </p>
          <Button
            className="w-full py-2.5"
            loading={busy}
            onClick={() => void startEnroll()}
          >
            <ShieldCheck className="size-4" /> {t('twoFactor.enable')}
          </Button>
        </div>
      )}

      {/* Enrôlement en cours : QR + secret + confirmation du code */}
      {enroll && (
        <TwoFactorEnrollForm
          enrollment={enroll}
          code={code}
          onCodeChange={setCode}
          busy={busy}
          error={err}
          onSubmit={confirmEnroll}
          onCancel={() => void cancelEnroll()}
        />
      )}
    </SectionCard>
  );
}
