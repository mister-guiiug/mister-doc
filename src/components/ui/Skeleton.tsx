/**
 * Squelettes de chargement : esquissent la FORME du contenu à venir au lieu
 * d'un spinner centré. La page ne « saute » plus à l'arrivée des données et
 * l'attente paraît plus courte.
 *
 * Accessibilité : le conteneur porte `role="status"` + `aria-busy`, avec un
 * libellé lisible par lecteur d'écran ; les barres décoratives sont masquées.
 */

/** Une barre grise animée (brique de base). */
export function SkeletonBar({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`block animate-pulse rounded bg-slate-200 dark:bg-slate-700 ${className}`}
    />
  );
}

/**
 * Squelette d'un tableau (compteurs d'équipe) : une ligne d'en-tête puis
 * `rows` lignes de cellules.
 */
export function SkeletonTable({
  rows = 6,
  label,
}: {
  rows?: number;
  label: string;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-3 py-4 sm:px-4"
    >
      <span className="sr-only">{label}</span>
      <SkeletonBar className="h-7 w-56" />
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3 border-b border-slate-100 px-3 py-3 dark:border-slate-800">
          <SkeletonBar className="h-4 w-32" />
          <SkeletonBar className="ml-auto h-4 w-10" />
          <SkeletonBar className="h-4 w-10" />
          <SkeletonBar className="h-4 w-10" />
          <SkeletonBar className="h-4 w-12" />
        </div>
        {Array.from({ length: rows }, (_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b border-slate-50 px-3 py-3 last:border-0 dark:border-slate-800/60"
          >
            <SkeletonBar className="size-2.5 shrink-0 rounded-full" />
            <SkeletonBar className="h-4 w-28" />
            <SkeletonBar className="ml-auto h-4 w-8" />
            <SkeletonBar className="h-4 w-8" />
            <SkeletonBar className="h-4 w-8" />
            <SkeletonBar className="h-4 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}
