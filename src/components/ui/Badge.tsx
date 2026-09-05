import type { ReactNode } from 'react';
import { TONE_CLASSES, type Tone } from '../../lib/tones.ts';

type Size = 'xs' | 'sm';

const SIZES: Record<Size, string> = {
  xs: 'gap-0.5 rounded px-1.5 py-0.5 text-[10px]',
  sm: 'gap-1 rounded-full px-2 py-0.5 text-xs',
};

/**
 * Chip du design system : petit libellé teinté (avec icône facultative), décliné
 * par {@link Tone} et deux tailles.
 *
 * POURQUOI CE COMPOSANT N'EST PAS CELUI DU SOCLE, décision réexaminée contre
 * `@mister-guiiug/dev-pwa-config` 3.24.0 et maintenue. Les deux n'ont pas le
 * même AXE : `react/badge` décline un ton **sémantique**, fermé à six
 * intentions (`brand`, `success`, `warning`, `danger`, `info`, `muted`) ;
 * celui-ci décline un ton **chromatique métier** — `teal`/`indigo` séparent une
 * garde de jour d'une garde de nuit, `violet`/`amber` un congé d'une formation,
 * `sky` les HNC. Cinq catégories de même niveau, dont aucune n'est une
 * réussite, un avertissement ni un danger : les replier sur les six intentions
 * ferait perdre la distinction, ou mentirait sur le sens.
 *
 * S'y ajoute `size="xs"`, dont la carte des créneaux se sert et que le socle
 * n'a pas (il n'a pas d'axe de taille). La décision redeviendra discutable le
 * jour où le socle ouvrira ses tons ou en ajoutera un — voir le README.
 */
export function Badge({
  tone = 'neutral',
  size = 'sm',
  icon,
  className = '',
  children,
}: {
  tone?: Tone;
  size?: Size;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center border font-medium ${SIZES[size]} ${TONE_CLASSES[tone]} ${className}`}
    >
      {icon}
      {children}
    </span>
  );
}
