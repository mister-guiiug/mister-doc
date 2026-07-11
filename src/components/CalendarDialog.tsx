import { useEffect, useState } from 'react';
import {
  X,
  Loader2,
  Copy,
  Check,
  CalendarPlus,
  Download,
  Rss,
} from 'lucide-react';
import { calendarFeedUrl, getCalendarToken } from '../backend/calendar.ts';

/**
 * Abonnement au flux iCalendar (.ics). Affiche l'URL secrète (équipe ou
 * personnelle) à coller dans un agenda, avec liens webcal / Google Agenda /
 * téléchargement.
 */
export function CalendarDialog({
  selfDoctorId,
  onClose,
}: {
  selfDoctorId: string;
  onClose: () => void;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<'team' | 'me'>('team');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getCalendarToken()
      .then(setToken)
      .catch(e => setError(e instanceof Error ? e.message : 'Erreur'))
      .finally(() => setLoading(false));
  }, []);

  const url = token
    ? calendarFeedUrl(token, scope === 'me' ? selfDoctorId : undefined)
    : '';
  const webcal = url.replace(/^https?:/, 'webcal:');
  const google = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(
    webcal
  )}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('Copie impossible — sélectionnez l’URL manuellement.');
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-end bg-black/40 sm:place-items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl dark:bg-slate-900 sm:rounded-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-semibold">
            <CalendarPlus className="size-5 text-teal-600" />
            S'abonner au calendrier
          </h3>
          <button
            onClick={onClose}
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
            <div className="mb-3 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-sm font-medium dark:bg-slate-800">
              <button
                onClick={() => setScope('team')}
                className={`rounded-md py-1.5 transition ${
                  scope === 'team'
                    ? 'bg-white shadow-sm dark:bg-slate-700'
                    : 'text-slate-500'
                }`}
              >
                Toute l'équipe
              </button>
              <button
                onClick={() => setScope('me')}
                className={`rounded-md py-1.5 transition ${
                  scope === 'me'
                    ? 'bg-white shadow-sm dark:bg-slate-700'
                    : 'text-slate-500'
                }`}
              >
                Mes gardes
              </button>
            </div>

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

            <p className="mt-4 text-xs text-slate-400">
              L'agenda se met à jour automatiquement (≈ 1×/h). Ce lien contient
              un code secret : ne le partagez qu'avec l'équipe.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
