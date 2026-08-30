import { useState } from 'react';
import { CalendarPlus } from 'lucide-react';
import { useI18n } from '../../i18n/index.ts';
import { Button } from '@mister-guiiug/dev-wpa-config/react/button';
import { SectionCard } from '../../components/ui/SectionCard.tsx';
import { CalendarDialog } from '../../components/CalendarDialog.tsx';

/**
 * Abonnement calendrier (.ics) : la gestion complète (lien, copie, rotation du
 * jeton) vit dans `CalendarDialog`, cette carte ne fait que l'ouvrir.
 */
export function CalendarCard() {
  const { t } = useI18n();
  const [calendar, setCalendar] = useState(false);
  return (
    <>
      <SectionCard
        icon={<CalendarPlus className="size-4" />}
        title={t('profile.calendarTitle')}
        desc={t('profile.calendarDesc')}
      >
        <Button
          variant="secondary"
          className="w-full py-2.5"
          onClick={() => setCalendar(true)}
        >
          <CalendarPlus className="size-4" /> {t('profile.manageSubscription')}
        </Button>
      </SectionCard>
      {calendar && <CalendarDialog onClose={() => setCalendar(false)} />}
    </>
  );
}
