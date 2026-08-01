import { Moon, Sun, SunMoon } from 'lucide-react';
import { useI18n } from '../../i18n/index.ts';
import { useTheme } from '../../lib/theme.ts';
import { SectionCard } from '../../components/ui/SectionCard.tsx';
import { SegmentedControl } from '../../components/ui/SegmentedControl.tsx';

/** Choix du thème clair / sombre (persisté par `useTheme`). */
export function AppearanceCard() {
  const { t } = useI18n();
  const { theme, setTheme } = useTheme();
  return (
    <SectionCard
      icon={<SunMoon className="size-4" />}
      title={t('profile.appearanceTitle')}
      desc={t('profile.appearanceDesc')}
    >
      <SegmentedControl
        fullWidth
        ariaLabel={t('profile.themeAria')}
        value={theme}
        onChange={setTheme}
        options={[
          {
            value: 'light',
            label: (
              <span className="flex items-center justify-center gap-1.5">
                <Sun className="size-4" /> {t('profile.light')}
              </span>
            ),
          },
          {
            value: 'dark',
            label: (
              <span className="flex items-center justify-center gap-1.5">
                <Moon className="size-4" /> {t('profile.dark')}
              </span>
            ),
          },
        ]}
      />
    </SectionCard>
  );
}
