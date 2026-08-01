import { Inbox } from 'lucide-react';
import { EmptyState } from '../../components/ui/EmptyState.tsx';

/**
 * En-tête commun aux catégories du tableau d'échanges (titre + compteur).
 * L'icône est surchargeable pour distinguer l'historique de la boîte de
 * réception.
 */
export function SwapSection({
  title,
  count,
  icon,
  children,
}: {
  title: string;
  count: number;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        {icon ?? <Inbox className="size-4 text-slate-400" />}
        <h2 className="font-semibold">{title}</h2>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800">
          {count}
        </span>
      </div>
      {children}
    </section>
  );
}

/** Message d'absence de proposition, plus compact que l'EmptyState par défaut. */
export function SwapEmpty({ children }: { children: React.ReactNode }) {
  return <EmptyState className="py-3">{children}</EmptyState>;
}
