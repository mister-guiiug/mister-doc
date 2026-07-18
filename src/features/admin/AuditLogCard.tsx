import { useEffect, useState } from 'react';
import { ScrollText } from 'lucide-react';
import { listAuditLog } from '../../backend/audit.ts';
import type { AuditEntry } from '../../backend/types.ts';
import { auditActionLabel, auditTargetLabel } from '../../lib/auditLabels.ts';
import { timeAgo } from '../../lib/relativeTime.ts';
import { SectionCard } from '../../components/ui/SectionCard.tsx';
import { EmptyState } from '../../components/ui/EmptyState.tsx';

/**
 * Journal d'audit (admin, lecture seule) : dernières actions sensibles
 * enregistrées par les triggers de la migration 0017.
 */
export function AuditLogCard() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listAuditLog()
      .then(e => {
        if (alive) setEntries(e);
      })
      .catch(e => {
        if (alive) setError(e instanceof Error ? e.message : 'Erreur');
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <SectionCard
      icon={<ScrollText className="size-4" />}
      title="Journal d'activité"
      desc="Actions sensibles : approbations, rôles, suppressions, verrous"
      count={entries?.length}
    >
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      ) : entries === null ? (
        <p className="py-2 text-sm text-slate-400">Chargement…</p>
      ) : entries.length === 0 ? (
        <Empty>Aucune action enregistrée pour le moment.</Empty>
      ) : (
        <ul className="flex flex-col divide-y divide-slate-100 text-sm dark:divide-slate-800">
          {entries.map(e => (
            <li key={e.id} className="flex items-baseline gap-2 py-1.5">
              <span className="min-w-0 flex-1">
                <span className="font-medium">{e.actor_name ?? '—'}</span>{' '}
                <span className="text-slate-500 dark:text-slate-400">
                  {auditActionLabel(e.action)}
                </span>{' '}
                <span className="font-medium">{auditTargetLabel(e)}</span>
              </span>
              <time
                dateTime={e.at}
                className="shrink-0 text-xs tabular-nums text-slate-400"
              >
                {timeAgo(e.at)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <EmptyState className="py-4">{children}</EmptyState>;
}
