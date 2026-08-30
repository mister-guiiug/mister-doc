import { Monitor, Moon, Sun, SunMoon } from 'lucide-react';
import { useThemeContext } from '@mister-guiiug/dev-wpa-config/react/theme-provider';
import { useI18n } from '../../i18n/index.ts';
import { SectionCard } from '../../components/ui/SectionCard.tsx';
import { SegmentedControl } from '../../components/ui/SegmentedControl.tsx';

type Preference = 'light' | 'dark' | 'system';

/**
 * Choix du thème clair / sombre / système.
 *
 * L'état vient du `ThemeProvider` monté dans `main.tsx` (persistance, écoute
 * du système et écriture de `data-theme` comprises) : la carte ne monte PAS
 * son propre `useTheme`, sans quoi deux instances écriraient `data-theme` et
 * l'app scintillerait au changement. Hors fournisseur (test isolé), repli
 * inerte sur « système ».
 */
export function AppearanceCard() {
  const { t } = useI18n();
  const themeCtx = useThemeContext();
  const theme = (themeCtx?.theme ?? 'system') as Preference;
  const setTheme = (pref: Preference): void => {
    themeCtx?.setTheme(pref);
  };

  return (
    <SectionCard
      icon={<SunMoon className="size-4" />}
      title={t('profile.appearanceTitle')}
      desc={t('profile.appearanceDesc')}
    >
      <SegmentedControl<Preference>
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
          {
            value: 'system',
            label: (
              <span className="flex items-center justify-center gap-1.5">
                <Monitor className="size-4" /> {t('profile.system')}
              </span>
            ),
          },
        ]}
      />
    </SectionCard>
  );
}
