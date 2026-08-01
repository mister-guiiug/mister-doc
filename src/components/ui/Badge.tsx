import type { ReactNode } from 'react';
import { TONE_CLASSES, type Tone } from '../../lib/tones.ts';

type Size = 'xs' | 'sm';

const SIZES: Record<Size, string> = {
  xs: 'gap-0.5 rounded px-1.5 py-0.5 text-[10px]',
  sm: 'gap-1 rounded-full px-2 py-0.5 text-xs',
};

/**
 * Chip du design system : petit libellé teinté (avec icône facultative), décliné
 * par {@link Tone} et deux tailles. Remplace les composants `Badge` réimplémentés
 * localement et les maps de tons dupliquées.
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
