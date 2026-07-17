import type { ReactNode } from 'react';

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
}

export interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentOption<T>[];
  size?: 'sm' | 'md';
  ariaLabel?: string;
  className?: string;
  /** Occupe toute la largeur, segments équirépartis. */
  fullWidth?: boolean;
}

/**
 * Contrôle segmenté générique (onglets « pilule »). Remplace les cinq variantes
 * réimplémentées à la main (login, congé, thème, période compteurs, calendrier).
 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
  ariaLabel,
  className = '',
  fullWidth = false,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800 ${
        fullWidth ? 'flex w-full' : 'inline-flex'
      } ${className}`}
    >
      {options.map(o => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`rounded-md text-center font-medium transition ${
              fullWidth ? 'flex-1' : ''
            } ${size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'} ${
              active
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
