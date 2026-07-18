import { useEffect, useState } from 'react';
import {
  X,
  Loader2,
  Copy,
  Check,
  CalendarPlus,
  Download,
  Rss,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';
import {
  calendarFeedUrl,
  calendarTokenStatus,
  getMyCalendarToken,
  rotateCalendarToken,
} from '../backend/calendar.ts';
import { useToast } from './Toast.tsx';
import { Modal } from './Modal.tsx';
import { Button } from './ui/Button.tsx';
import { SegmentedControl } from './ui/SegmentedControl.tsx';
import { useConfirm } from './ui/confirmContext.ts';

/**
 * Abonnement au flux iCalendar (.ics). Le token est HASHÉ au repos (migration
 * 0018) : il n'est donc plus ré-affichable et n'apparaît qu'UNE fois, à la
 * génération/régénération. Compatible avec l'ancien schéma (mode « legacy » tant
 * que la RPC `calendar_token_status` n'existe pas encore).
 */
export function CalendarDialog({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [mode, setMode] = useState<'loading' | 'legacy' | 'hashed'>('loading');
  // `token` : source des URLs. Legacy → token persistant ; hashé → token fraîchement
  // généré (montré une fois), sinon null.
  const [token, setToken] = useState<string | null>(null);
  const [hasToken, setHasToken] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<'team' | 'me'>('team');
  const [timed, setTimed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void calendarTokenStatus().then(status => {
      if (!alive) return;
      if (status === null) {
        // Base non migrée : repli sur le comportement historique (token en clair).
        getMyCalendarToken()
          .then(t => {
            if (alive) {
              setToken(t);
              setMode('legacy');
            }
          })
          .catch(e => {
            if (alive) setError(e instanceof Error ? e.message : 'Erreur');
          });
      } else {
        setHasToken(status);
        setMode('hashed');
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const url = token ? calendarFeedUrl(token, { scope, timed }) : '';
  const webcal = url.replace(/^https?:/, 'webcal:');
  const google = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Copie impossible — sélectionnez l’URL manuellement.');
    }
  }

  // Génère (ou régénère, avec confirmation) le lien et l'affiche une fois.
  async function generate(regenerate: boolean) {
    if (
      regenerate &&
      !(await confirm({
        message:
          'Régénérer le lien ? Les abonnements existants cesseront de fonctionner.',
        danger: true,
        confirmLabel: 'Régénérer',
      }))
    )
      return;
    setBusy(true);
    try {
      const t = await rotateCalendarToken();
      setToken(t);
      setHasToken(true);
      toast.success('Nouveau lien généré.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  }

  // Le bloc URL est visible en legacy, ou en hashé juste après génération.
  const showFeed = mode === 'legacy' || (mode === 'hashed' && token !== null);

  return (
    <Modal onClose={onClose} className="max-w-md rounded-t-2xl p-5 sm:rounded-2xl">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold">
          <CalendarPlus className="size-5 text-teal-600" />
          S'abonner au calendrier
        </h3>
        <button
          onClick={onClose}
          aria-label="Fermer"
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="size-5" />
        </button>
      </div>

      {mode === 'loading' ? (
        <div className="grid place-items-center py-8 text-slate-400">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      ) : showFeed ? (
        <>
          {mode === 'hashed' && (
            <p className="mb-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" />
              <span>
                Copiez ce lien <strong>maintenant</strong> : pour votre sécurité,
                il ne sera plus affiché ensuite.
              </span>
            </p>
          )}

          <SegmentedControl
            className="mb-2"
            fullWidth
            ariaLabel="Portée du calendrier"
            value={scope}
            onChange={setScope}
            options={[
              { value: 'team', label: "Toute l'équipe" },
              { value: 'me', label: 'Mes gardes' },
            ]}
          />

          <label className="mb-3 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={timed}
              onChange={e => setTimed(e.target.checked)}
              className="size-4 accent-teal-600"
            />
            Événements horodatés (sinon journée entière)
          </label>

          <div className="mb-3 flex items-stretch gap-2">
            <input
              readOnly
              value={url}
              onFocus={e => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-800"
            />
            <button
              onClick={copy}
              className="flex shrink-0 items-center gap-1 rounded-lg bg-teal-600 px-3 text-sm font-semibold text-white hover:bg-teal-700"
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? 'Copié' : 'Copier'}
            </button>
          </div>

          <div className="flex flex-col gap-2">
            <a
              href={webcal}
              className="flex items-center justify-center gap-2 rounded-lg border border-slate-300 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
            >
              <Rss className="size-4" /> S'abonner (Apple / Outlook)
            </a>
            <a
              href={google}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 rounded-lg border border-slate-300 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
            >
              <CalendarPlus className="size-4" /> Ajouter à Google Agenda
            </a>
            <a
              href={url}
              download="mister-doc.ics"
              className="flex items-center justify-center gap-2 rounded-lg border border-slate-300 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
            >
              <Download className="size-4" /> Télécharger le .ics
            </a>
          </div>

          {mode === 'legacy' && (
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
              <p className="text-xs text-slate-400">
                Lien personnel secret. Mise à jour auto ≈ 1×/h.
              </p>
              <button
                onClick={() => void generate(true)}
                disabled={busy}
                className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-red-600 disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="size-3.5" />
                )}
                Régénérer
              </button>
            </div>
          )}
        </>
      ) : (
        // Hashé, aucun token affiché : proposer de générer / régénérer.
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {hasToken
              ? "Un lien d'abonnement personnel est déjà actif. Pour votre sécurité, il n'est plus affiché ici."
              : 'Générez votre lien personnel d’abonnement au planning (gardes, congés, formations).'}
          </p>
          <Button
            className="w-full py-2.5"
            loading={busy}
            onClick={() => void generate(hasToken)}
          >
            {!busy && <CalendarPlus className="size-4" />}
            {hasToken ? 'Régénérer le lien' : 'Générer mon lien'}
          </Button>
          {hasToken && (
            <p className="text-xs text-slate-400">
              Régénérer crée un nouveau lien et invalide l'ancien (les abonnements
              en place cesseront de fonctionner).
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
