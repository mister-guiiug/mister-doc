import { useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';
import { useI18n } from '../../i18n/index.ts';
import { useToast } from '../../components/Toast.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { SectionCard } from '../../components/ui/SectionCard.tsx';
import {
  currentPushEndpoint,
  disablePush,
  enablePush,
  pushConfigured,
  pushDenied,
} from '../../lib/push.ts';

/**
 * Notifications push (opt-in, par navigateur). La carte est masquée si le push
 * n'est pas configuré côté déploiement (clé VAPID absente).
 */
export function PushCard({ doctorId }: { doctorId: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const pushOn = pushConfigured();
  const [push, setPush] = useState<
    'loading' | 'on' | 'off' | 'denied' | 'busy'
  >('loading');

  // État initial du push (abonné sur ce navigateur ? autorisation refusée ?).
  useEffect(() => {
    if (!pushOn) return;
    let alive = true;
    currentPushEndpoint()
      .then(ep => {
        if (alive) setPush(ep ? 'on' : pushDenied() ? 'denied' : 'off');
      })
      .catch(() => {
        if (alive) setPush('off');
      });
    return () => {
      alive = false;
    };
  }, [pushOn]);

  async function togglePush() {
    if (push === 'on') {
      setPush('busy');
      try {
        await disablePush();
        setPush('off');
        toast.success(t('profile.pushDisabled'));
      } catch {
        setPush('on');
        toast.error(t('profile.pushDisableError'));
      }
      return;
    }
    setPush('busy');
    try {
      const r = await enablePush(doctorId);
      setPush(r === 'on' ? 'on' : 'denied');
      if (r === 'on') toast.success(t('profile.pushEnabled'));
      else toast.error(t('profile.pushDenied'));
    } catch {
      setPush('off');
      toast.error(t('profile.pushEnableError'));
    }
  }

  if (!pushOn) return null;

  return (
    <SectionCard
      icon={<BellRing className="size-4" />}
      title={t('profile.pushTitle')}
      desc={t('profile.pushDesc')}
    >
      {push === 'denied' ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          {t('profile.pushBlocked')}
        </p>
      ) : (
        <Button
          variant={push === 'on' ? 'secondary' : 'primary'}
          className="w-full py-2.5"
          loading={push === 'busy' || push === 'loading'}
          onClick={() => void togglePush()}
        >
          {push !== 'busy' && push !== 'loading' && (
            <BellRing className="size-4" />
          )}
          {push === 'on' ? t('profile.pushDisable') : t('profile.pushEnable')}
        </Button>
      )}
    </SectionCard>
  );
}
