import { Languages } from 'lucide-react';
import { useI18n } from '../../i18n/index.ts';
import { SectionCard } from '../../components/ui/SectionCard.tsx';
import { SegmentedControl } from '../../components/ui/SegmentedControl.tsx';

/** Choix de la langue de l'interface (persisté par le provider i18n). */
export function LanguageCard() {
  const { t, locale, setLocale, locales } = useI18n();
  return (
    <SectionCard
      icon={<Languages className="size-4" />}
      title={t('settings.languageTitle')}
      desc={t('settings.languageDesc')}
    >
      <SegmentedControl
        fullWidth
        ariaLabel={t('settings.languageAria')}
        value={locale}
        onChange={setLocale}
        options={locales.map(l => ({
          value: l,
          label: l === 'fr' ? t('settings.french') : t('settings.english'),
        }))}
      />
    </SectionCard>
  );
}
