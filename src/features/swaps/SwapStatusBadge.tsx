import { useI18n } from '../../i18n/index.ts';
import type { SwapStatus } from '../../backend/types.ts';
import { Badge } from '../../components/ui/Badge.tsx';
import type { Tone } from '../../lib/tones.ts';

/**
 * Correspondance statut → ton du design system. Extraite en constante de module
 * (plutôt qu'une cascade de ternaires dans le rendu) pour rester la source unique
 * si un nouveau statut apparaît, et pour que TypeScript signale tout statut oublié
 * grâce au `Record<SwapStatus, Tone>`.
 *
 * `pending` reprend le ton neutre : une proposition en attente n'est ni un succès
 * ni un refus, elle ne doit donc pas capter l'attention comme les états résolus.
 */
const STATUS_TONES: Record<SwapStatus, Tone> = {
  pending: 'neutral',
  accepted: 'teal',
  declined: 'red',
  cancelled: 'neutral',
};

/**
 * Pastille de statut d'une proposition d'échange, partagée par les vues « échanges ».
 * Vivait auparavant en local dans `SwapHistory` avec ses propres classes Tailwind :
 * la remontée dans un module dédié évite la duplication et fait passer les couleurs
 * par {@link Badge} / `TONE_CLASSES`, seuls responsables du rendu clair ET sombre.
 */
export function SwapStatusBadge({
  status,
  className = '',
}: {
  status: SwapStatus;
  className?: string;
}) {
  const { t } = useI18n();

  // Les libellés restent des clés i18n existantes ; `pending` n'en a pas encore,
  // on affiche donc le statut brut plutôt que d'inventer une clé.
  const label =
    status === 'accepted'
      ? t('swaps.statusAccepted')
      : status === 'declined'
        ? t('swaps.statusDeclined')
        : status === 'cancelled'
          ? t('swaps.statusCancelled')
          : status;

  return (
    // `shrink-0` : la pastille ne doit jamais être compressée par le libellé
    // voisin dans une ligne en `flex-wrap`.
    <Badge tone={STATUS_TONES[status]} className={`shrink-0 ${className}`}>
      {label}
    </Badge>
  );
}
