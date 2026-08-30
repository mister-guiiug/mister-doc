import { Check, X } from 'lucide-react';
import { Button } from '@mister-guiiug/dev-wpa-config/react/button';
import { useI18n } from '../../i18n/index.ts';
import type { TotpEnrollment } from '../../backend/mfa.ts';

type Props = {
  /** Enrôlement en attente (QR + secret) renvoyé par `enrollTotp()`. */
  enrollment: TotpEnrollment;
  /**
   * Code à 6 chiffres saisi. L'état vit dans la carte parente : c'est elle qui
   * doit pouvoir le vider après une vérification refusée, sans démonter le
   * formulaire (donc sans reperdre le focus ni relancer l'enrôlement).
   */
  code: string;
  onCodeChange: (code: string) => void;
  /** Une opération réseau est en cours (vérification du code). */
  busy: boolean;
  /** Message d'erreur déjà traduit, ou `null`. */
  error: string | null;
  onSubmit: (ev: React.FormEvent) => void;
  onCancel: () => void;
};

/**
 * Étape d'activation de la 2FA : QR code à scanner, secret en saisie manuelle
 * de secours, puis confirmation par le code à 6 chiffres. Aucun état ni appel
 * réseau ici — le secret et l'appel de confirmation restent dans la carte, au
 * plus près de leur cycle de vie.
 */
export function TwoFactorEnrollForm({
  enrollment,
  code,
  onCodeChange,
  busy,
  error,
  onSubmit,
  onCancel,
}: Props) {
  const { t } = useI18n();

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
        <li>{t('twoFactor.enrollStep1')}</li>
        <li>{t('twoFactor.enrollStep2')}</li>
      </ol>
      <div className="mx-auto rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-700">
        {/* data:image/svg+xml fourni par Supabase — autorisé par la CSP img-src data:. */}
        <img
          src={enrollment.qrCode}
          alt={t('twoFactor.qrAlt')}
          width={176}
          height={176}
          className="size-44"
        />
      </div>
      <div className="rounded-lg bg-slate-50 px-3 py-2 text-center dark:bg-slate-800">
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {t('twoFactor.manualEntry')}
        </span>
        <p className="mt-0.5 break-all font-mono text-xs font-medium">
          {enrollment.secret}
        </p>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-600 dark:text-slate-300">
          {t('twoFactor.code6Label')}
        </span>
        <input
          value={code}
          onChange={e =>
            onCodeChange(e.target.value.replace(/\D/g, '').slice(0, 6))
          }
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          placeholder="123456"
          autoFocus
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-center text-lg tracking-[0.3em] tabular-nums outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 dark:border-slate-600 dark:bg-slate-900"
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

      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          className="flex-1 py-2.5"
          onClick={onCancel}
        >
          <X className="size-4" /> {t('twoFactor.cancel')}
        </Button>
        <Button
          type="submit"
          className="flex-1 py-2.5"
          loading={busy}
          disabled={code.trim().length < 6}
        >
          <Check className="size-4" /> {t('twoFactor.verify')}
        </Button>
      </div>
    </form>
  );
}
