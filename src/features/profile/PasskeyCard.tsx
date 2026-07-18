import { useEffect, useRef, useState } from 'react';
import { Fingerprint, Plus, Trash2 } from 'lucide-react';
import { useToast } from '../../components/Toast.tsx';
import { useConfirm } from '../../components/ui/confirmContext.ts';
import { Button } from '../../components/ui/Button.tsx';
import { SectionCard } from '../../components/ui/SectionCard.tsx';
import {
  deletePasskey,
  listPasskeys,
  passkeysSupported,
  registerPasskey,
  type Passkey,
} from '../../backend/passkey.ts';

type Status = 'loading' | 'ready' | 'error' | 'unsupported';

/** Date lisible (jj mois aaaa) à partir d'un ISO. */
function frDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
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
      toast.success('Passkey enregistrée — vous pouvez désormais vous connecter avec l’empreinte.');
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  async function remove(p: Passkey) {
    const ok = await confirm({
      title: 'Retirer cette passkey ?',
      message:
        'Cet appareil ne pourra plus se connecter par empreinte. Vous pourrez en réenregistrer une à tout moment.',
      confirmLabel: 'Retirer',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await deletePasskey(p.id);
      toast.success('Passkey retirée.');
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  return (
    <SectionCard
      icon={<Fingerprint className="size-4" />}
      title="Connexion par empreinte"
      desc="Passkey (empreinte, Face ID, Windows Hello) pour se connecter sans mot de passe"
    >
      {status === 'unsupported' && (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          Cet appareil ou ce navigateur ne prend pas en charge les passkeys.
        </p>
      )}

      {status === 'loading' && (
        <p className="text-sm text-slate-500 dark:text-slate-400">Chargement…</p>
      )}

      {status === 'error' && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          État indisponible (hors ligne ?). Réessayez une fois connecté.
        </p>
      )}

      {status === 'ready' && (
        <div className="flex flex-col gap-3">
          {passkeys.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <Fingerprint className="size-4 shrink-0 text-slate-400" />
              Aucune passkey enregistrée sur ce compte.
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
                      {p.friendlyName || 'Passkey'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Ajoutée le {frDate(p.createdAt)}
                      {p.lastUsedAt && ` · utilisée le ${frDate(p.lastUsedAt)}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Retirer cette passkey"
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
            {!busy && <Plus className="size-4" />} Ajouter une passkey
          </Button>
        </div>
      )}
    </SectionCard>
  );
}
