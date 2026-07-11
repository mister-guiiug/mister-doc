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
} from 'lucide-react';
import {
  calendarFeedUrl,
  getMyCalendarToken,
  rotateCalendarToken,
} from '../backend/calendar.ts';
import { useToast } from './Toast.tsx';
import { Modal } from './Modal.tsx';

/**
 * Abonnement au flux iCalendar (.ics) : token PERSONNEL révocable, portée
 * équipe/perso, événements journée entière ou horodatés.
 */
export function CalendarDialog({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<'team' | 'me'>('team');
  const [timed, setTimed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getMyCalendarToken()
      .then(setToken)
      .catch(e => setError(e instanceof Error ? e.message : 'Erreur'))
      .finally(() => setLoading(false));
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

  async function regenerate() {
    if (!confirm('Régénérer le lien ? Les abonnements existants cesseront de fonctionner.'))
      return;
    setBusy(true);
    try {
      setToken(await rotateCalendarToken());
      toast.success('Nouveau lien généré.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  }

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

      {loading ? (
        <div className="grid place-items-center py-8 text-slate-400">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      ) : (
        <>
          <div className="mb-2 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-sm font-medium dark:bg-slate-800">
            <button
              onClick={() => setScope('team')}
              className={`rounded-md py-1.5 transition ${scope === 'team' ? 'bg-white shadow-sm dark:bg-slate-700' : 'text-slate-500'}`}
            >
              Toute l'équipe
            </button>
            <button
              onClick={() => setScope('me')}
              className={`rounded-md py-1.5 transition ${scope === 'me' ? 'bg-white shadow-sm dark:bg-slate-700' : 'text-slate-500'}`}
            >
              Mes gardes
            </button>
          </div>

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

          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
            <p className="text-xs text-slate-400">
              Lien personnel secret. Mise à jour auto ≈ 1×/h.
            </p>
            <button
              onClick={() => void regenerate()}
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
        </>
      )}
    </Modal>
  );
}
