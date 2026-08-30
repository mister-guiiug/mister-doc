import { useState } from 'react';
import { Check, Copy, Share2 } from 'lucide-react';
import { useI18n } from '../../i18n/index.ts';
import { useToast } from '@mister-guiiug/dev-wpa-config/react/toast';
import { Button } from '@mister-guiiug/dev-wpa-config/react/button';
import { SectionCard } from '../../components/ui/SectionCard.tsx';

/**
 * Partage de l'application : partage natif si le navigateur le propose
 * (mobile), sinon repli sur la copie du lien dans le presse-papiers.
 */
export function ShareCard() {
  const { t } = useI18n();
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  // Lien racine de l'application (HashRouter → l'accueil), indépendant de la
  // route courante. `BASE_URL` vaut « /mister-doc/ » en prod, « / » en local.
  const appUrl = window.location.origin + import.meta.env.BASE_URL;
  const canShare = typeof navigator.share === 'function';

  async function handleShare() {
    if (canShare) {
      try {
        await navigator.share({
          title: 'mister-doc',
          text: t('profile.shareText'),
          url: appUrl,
        });
      } catch {
        /* partage annulé par l'utilisateur */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast.success(t('profile.linkCopiedToast'));
    } catch {
      toast.error(t('profile.copyImpossible'));
    }
  }

  return (
    <SectionCard
      icon={<Share2 className="size-4" />}
      title={t('profile.shareTitle')}
      desc={t('profile.shareDesc')}
    >
      <div className="mb-3 flex items-center rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800">
        <span className="truncate font-mono text-slate-500 dark:text-slate-400">
          {appUrl}
        </span>
      </div>
      <Button
        variant="secondary"
        className="w-full py-2.5"
        onClick={() => void handleShare()}
      >
        {copied ? (
          <Check className="size-4 text-teal-600" />
        ) : canShare ? (
          <Share2 className="size-4" />
        ) : (
          <Copy className="size-4" />
        )}
        {copied ? t('profile.linkCopied') : t('profile.shareApp')}
      </Button>
    </SectionCard>
  );
}
