import { useState } from 'react';
import { Info, RefreshCw } from 'lucide-react';
import { useI18n } from '../../i18n/index.ts';
import { Button } from '@mister-guiiug/dev-pwa-config/react/button';
import { SectionCard } from '../../components/ui/SectionCard.tsx';
import { forceUpdate } from '../../lib/appVersion.ts';

/**
 * Mise à jour forcée (purge le service worker puis recharge) : dépanne les
 * installations PWA restées sur un ancien build.
 *
 * La carte affichait aussi le numéro de build. Il est parti avec les vingt-six
 * autres du parc : il nommait ce qui tourne sans permettre d'y changer quoi que
 * ce soit — le bouton, lui, le fait.
 */
export function AppInfoCard() {
  const { t } = useI18n();
  const [updating, setUpdating] = useState(false);
  return (
    <SectionCard
      icon={<Info className="size-4" />}
      title={t('profile.appTitle')}
      desc={t('profile.appDesc')}
    >
      {/* Plus de ligne « Version » : elle nommait le build sans permettre d'en
          faire quoi que ce soit. Le bouton ci-dessous, lui, en change. */}
      <Button
        variant="secondary"
        className="w-full py-2.5"
        disabled={updating}
        onClick={() => {
          setUpdating(true);
          void forceUpdate();
        }}
      >
        <RefreshCw className={`size-4 ${updating ? 'animate-spin' : ''}`} />
        {t('profile.forceUpdate')}
      </Button>
    </SectionCard>
  );
}
