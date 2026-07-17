import type { ReactNode } from 'react';

/** Message d'état vide standardisé (liste sans élément). */
export function EmptyState({
  className = 'py-6',
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <p className={`text-center text-sm text-slate-400 ${className}`}>
      {children}
    </p>
  );
}
