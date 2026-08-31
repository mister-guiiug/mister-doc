import { AlertTriangle, WifiOff } from 'lucide-react';
import { useOnline } from '@mister-guiiug/dev-wpa-config/react/use-online';
import { useI18n } from '../../i18n/index.ts';
import { ErrorMessage } from '../../components/ui/ErrorMessage.tsx';

/** Horodatage court `DD/MM HH:MM` (dernière synchro affichée hors-ligne). */
function syncLabel(ts: number, locale: string): string {
  return new Date(ts).toLocaleString(locale === 'en' ? 'en-GB' : 'fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface PlanningBannersProps {
  error: string | null;
  offline: boolean;
  /** Horodatage de la dernière synchro réussie (ou du cliché en cache). */
  lastSync: number | null;
  /** Nombre de créneaux non couverts du mois (0 = pas de bandeau). */
  uncoveredCount: number;
  onSeeUncovered: () => void;
}

/**
 * Bandeaux d'information affichés au-dessus de la grille : erreur de
 * chargement, mode hors-ligne (données en cache) et alerte des créneaux non
 * couverts, avec un raccourci vers le premier d'entre eux.
 */
export function PlanningBanners({
  error,
  offline,
  lastSync,
  uncoveredCount,
  onSeeUncovered,
}: PlanningBannersProps) {
  const { t, locale } = useI18n();
  const online = useOnline();

  return (
    <>
      {error && <ErrorMessage>{error}</ErrorMessage>}

      {offline && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
          <WifiOff className="size-4 shrink-0" />
          {/* DEUX BANDEAUX AMBRÉS QUI DISENT « HORS LIGNE » L'UN SOUS L'AUTRE,
              c'est un défaut visuel qu'aucun test ne verrait. Depuis que la
              coquille porte le bandeau réseau du socle, celui-ci n'annonce
              plus la panne : il ne garde que ce que l'autre ne peut PAS dire
              — le planning vient du cache, et de quand il date.

              Le préfixe « Hors ligne — » reste utile dans l'autre cas, bien
              réel : le navigateur se croit connecté et le chargement échoue
              quand même (Supabase indisponible, portail captif d'hôpital,
              DNS). Là, aucun bandeau global ne s'affiche, et celui-ci est
              seul à parler. */}
          <span className="flex-1">
            {online ? t('planning.offlinePrefix') : t('planning.cachePrefix')}
            {lastSync
              ? t('planning.offlineSynced', {
                  date: syncLabel(lastSync, locale),
                })
              : ''}
            {t('planning.offlineSuffix')}
          </span>
        </div>
      )}

      {uncoveredCount > 0 && (
        <button
          onClick={onSeeUncovered}
          className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-left text-sm text-red-700 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
        >
          <AlertTriangle className="size-4 shrink-0" />
          <span className="flex-1">
            {uncoveredCount > 1
              ? t('planning.uncoveredMany', { count: uncoveredCount })
              : t('planning.uncoveredOne', { count: uncoveredCount })}
          </span>
          <span className="font-semibold underline">{t('planning.see')}</span>
        </button>
      )}
    </>
  );
}
