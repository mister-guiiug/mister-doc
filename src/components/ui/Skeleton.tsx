import {
  Skeleton,
  SkeletonGroup,
} from '@mister-guiiug/dev-pwa-config/react/skeleton';

/**
 * Squelette de chargement du tableau des compteurs : esquisse la FORME du
 * contenu à venir (une ligne d'en-tête puis `rows` lignes de cellules) au lieu
 * d'un spinner centré.
 *
 * Composé sur les briques du socle : `SkeletonGroup` porte `role="status"`,
 * `aria-busy` et le libellé lisible par lecteur d'écran ; chaque `Skeleton`
 * est décoratif (`aria-hidden`). Seule la mise en page (celle du tableau des
 * compteurs) reste locale.
 */
export function SkeletonTable({
  rows = 6,
  label,
}: {
  rows?: number;
  label: string;
}) {
  return (
    <SkeletonGroup
      label={label}
      className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-3 py-4 sm:px-4"
    >
      <Skeleton width="14rem" height="1.75rem" />
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3 border-b border-slate-100 px-3 py-3 dark:border-slate-800">
          <Skeleton width="8rem" height="1rem" />
          <Skeleton className="ml-auto" width="2.5rem" height="1rem" />
          <Skeleton width="2.5rem" height="1rem" />
          <Skeleton width="2.5rem" height="1rem" />
          <Skeleton width="3rem" height="1rem" />
        </div>
        {Array.from({ length: rows }, (_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b border-slate-50 px-3 py-3 last:border-0 dark:border-slate-800/60"
          >
            <Skeleton
              className="shrink-0"
              width="0.625rem"
              height="0.625rem"
              radius="full"
            />
            <Skeleton width="7rem" height="1rem" />
            <Skeleton className="ml-auto" width="2rem" height="1rem" />
            <Skeleton width="2rem" height="1rem" />
            <Skeleton width="2rem" height="1rem" />
            <Skeleton width="3rem" height="1rem" />
          </div>
        ))}
      </div>
    </SkeletonGroup>
  );
}
