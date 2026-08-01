import { fromISODate, mondayIndex } from '../../lib/dates.ts';
import { useI18n } from '../../i18n/index.ts';

/**
 * Libellés de date du tableau d'échanges. Regroupés dans un hook car ils
 * dépendent tous deux du catalogue i18n et sont partagés par la liste des
 * propositions et l'historique : les dupliquer ferait diverger les formats.
 */
export function useSwapDateLabels() {
  const { t, m } = useI18n();

  const dayLabel = (iso: string): string => {
    const d = fromISODate(iso);
    return `${m.common.weekdays[mondayIndex(d)]} ${d.getDate()}/${d.getMonth() + 1}`;
  };

  // « aujourd'hui » / « demain » / « dans N j » / « passé » relatif à aujourd'hui.
  const relativeDay = (iso: string): string => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Math.round(
      (fromISODate(iso).getTime() - today.getTime()) / 86_400_000
    );
    if (days < 0) return t('swaps.past');
    if (days === 0) return t('swaps.todayRel');
    if (days === 1) return t('swaps.tomorrow');
    return t('swaps.inDays', { n: days });
  };

  return { dayLabel, relativeDay };
}
