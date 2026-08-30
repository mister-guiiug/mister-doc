import { useEffect, useRef, useState } from 'react';
import { Fingerprint, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@mister-guiiug/dev-wpa-config/react/toast';
import { useConfirm } from '../../components/ui/confirmContext.ts';
import { Button } from '@mister-guiiug/dev-wpa-config/react/button';
import { SectionCard } from '../../components/ui/SectionCard.tsx';
import { useI18n } from '../../i18n/index.ts';
import {
  deletePasskey,
  listPasskeys,
  passkeysSupported,
  registerPasskey,
  type Passkey,
} from '../../backend/passkey.ts';

type Status = 'loading' | 'ready' | 'error' | 'unsupported';

/** Date lisible (jj mois aaaa) à partir d'un ISO. */
function fmtDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale === 'en' ? 'en-GB' : 'fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Connexion par empreinte (passkeys / WebAuthn) dans le profil. Opt-in : le
 * médecin enregistre une passkey sur un appareil doté d'un capteur (empreinte,
 * Face ID, Windows Hello), puis peut se connecter sans mot de passe. La liste
 * permet d'en ajouter et d'en retirer (par appareil).
 */
export function PasskeyCard() {
  const toast = useToast();
  const confirm = useConfirm();
  const { t, locale } = useI18n();
  const supported = passkeysSupported();
  const [status, setStatus] = useState<Status>(
    supported ? 'loading' : 'unsupported'
  );
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  async function refresh() {
    try {
      const list = await listPasskeys();
      if (alive.current) {
        setPasskeys(list);
        setStatus('ready');
      }
    } catch {
      if (alive.current) setStatus('error');
    }
  }
  useEffect(() => {
    if (supported) void refresh();
  }, [supported]);

  async function add() {
    setBusy(true);
    try {
      await registerPasskey();
      toast.success(t('passkey.registered'));
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('common.error'));
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  async function remove(p: Passkey) {
    const ok = await confirm({
      title: t('passkey.removeConfirmTitle'),
      message: t('passkey.removeConfirmMsg'),
      confirmLabel: t('passkey.removeLabel'),
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await deletePasskey(p.id);
      toast.success(t('passkey.removed'));
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('common.error'));
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  return (
    <SectionCard
      icon={<Fingerprint className="size-4" />}
      title={t('passkey.title')}
      desc={t('passkey.desc')}
    >
      {status === 'unsupported' && (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          {t('passkey.unsupported')}
        </p>
      )}

      {status === 'loading' && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t('passkey.loading')}
        </p>
      )}

      {status === 'error' && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          {t('passkey.unavailable')}
        </p>
      )}

      {status === 'ready' && (
        <div className="flex flex-col gap-3">
          {passkeys.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <Fingerprint className="size-4 shrink-0 text-slate-400" />
              {t('passkey.none')}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {passkeys.map(p => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {p.friendlyName || t('passkey.defaultName')}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t('passkey.addedOn', {
                        date: fmtDate(p.createdAt, locale),
                      })}
                      {p.lastUsedAt &&
                        t('passkey.usedOn', {
                          date: fmtDate(p.lastUsedAt, locale),
                        })}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={t('passkey.removeAria')}
                    disabled={busy}
                    onClick={() => void remove(p)}
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/40"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Button
            className="w-full py-2.5"
            loading={busy}
            onClick={() => void add()}
          >
            {!busy && <Plus className="size-4" />} {t('passkey.add')}
          </Button>
        </div>
      )}
    </SectionCard>
  );
}
