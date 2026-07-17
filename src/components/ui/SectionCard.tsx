import type { ReactNode } from 'react';

/**
 * Carte de section titrée du design system : conteneur (bord + fond + coins 2xl
 * + ombre légère) avec un en-tête « icône pastillée + titre (+ description) » et,
 * en option, un compteur ou un contenu à droite. Réconcilie les `Card`/`Section`
 * réimplémentés dans AdminPanel / ProfilePage / BackupCard.
 *
 * L'icône est colorée par la pastille (teal) : passez-la SANS classe de couleur
 * (ex. `<Settings className="size-4" />`).
 */
export function SectionCard({
  title,
  icon,
  desc,
  count,
  headerRight,
  className = '',
  children,
}: {
  title: string;
  icon?: ReactNode;
  desc?: string;
  count?: number;
  headerRight?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      <div className="mb-3 flex items-center gap-2">
        {icon && (
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-teal-600 dark:bg-slate-800">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          {desc && (
            <p className="text-xs text-slate-500 dark:text-slate-400">{desc}</p>
          )}
        </div>
        {count !== undefined && (
          <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800">
            {count}
          </span>
        )}
        {headerRight && <div className="ml-auto">{headerRight}</div>}
      </div>
      {children}
    </section>
  );
}
