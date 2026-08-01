import { useState } from 'react';
import { Info, RefreshCw } from 'lucide-react';
import { useI18n } from '../../i18n/index.ts';
import { Button } from '../../components/ui/Button.tsx';
import { SectionCard } from '../../components/ui/SectionCard.tsx';
import { APP_BUILD, forceUpdate } from '../../lib/appVersion.ts';

/**
 * Version de l'application et mise à jour forcée (purge le service worker puis
 * recharge) : dépanne les installations PWA restées sur un ancien build.
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
      <div className="mb-3 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800">
        <span className="text-slate-500 dark:text-slate-400">
          {t('profile.version')}
        </span>
        <span className="font-mono text-xs font-medium tabular-nums">
          {APP_BUILD}
        </span>
      </div>
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
