import { LayoutGrid } from 'lucide-react';
import { FamilyApps } from '@mister-guiiug/dev-pwa-config/react';
import { useI18n } from '../../i18n/index.ts';
import { SectionCard } from '../../components/ui/SectionCard.tsx';

/** Autres applications de la famille (composant partagé, catalogue). */
export function OtherAppsCard() {
  const { t } = useI18n();
  return (
    <SectionCard
      icon={<LayoutGrid className="size-4" />}
      title={t('profile.otherAppsTitle')}
      desc={t('profile.otherAppsDesc')}
    >
      <div className="family-apps">
        <FamilyApps
          currentAppId="mister-doc"
          showSponsor={false}
          // Les deux réglages que `index.css` posait en CSS : la SectionCard
          // fournit déjà son titre, et l'app refaisait la grille en flex.
          showTitle={false}
          layout="list"
          // Dix-neuf cartes d'affilée : repliées par catégorie, sept lignes.
          groupBy="category"
        />
      </div>
    </SectionCard>
  );
}
