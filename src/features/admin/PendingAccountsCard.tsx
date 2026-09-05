import { Clock, UserCheck, UserX } from 'lucide-react';
import type { Doctor } from '../../backend/types.ts';
import { Button } from '@mister-guiiug/dev-pwa-config/react/button';
import { EmptyState } from '@mister-guiiug/dev-pwa-config/react/empty-state';
import { SectionCard } from '../../components/ui/SectionCard.tsx';
import { useConfirm } from '../../components/ui/confirmContext.ts';
import { useI18n } from '../../i18n/index.ts';
import { Dot } from './Dot.tsx';

/**
 * Comptes créés mais pas encore validés par un admin : approbation ou rejet.
 * Le rejet demande confirmation ici, les mutations restent dans AdminPanel.
 */
export function PendingAccountsCard({
  pending,
  busyId,
  onApprove,
  onReject,
}: {
  pending: Doctor[];
  busyId: string | null;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const confirm = useConfirm();
  const { t } = useI18n();

  return (
    <SectionCard
      title={t('admin.pendingTitle')}
      icon={<Clock className="size-4" />}
      count={pending.length}
    >
      {pending.length === 0 ? (
        <Empty>{t('admin.noPending')}</Empty>
      ) : (
        <ul className="flex flex-col gap-2">
          {pending.map(d => (
            <li
              key={d.id}
              className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 dark:border-slate-700"
            >
              <Dot color={d.color} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{d.name}</p>
                <p className="truncate text-xs text-slate-400">{d.email}</p>
              </div>
              <Button
                size="sm"
                loading={busyId === d.id}
                onClick={() => onApprove(d.id)}
              >
                {busyId !== d.id && <UserCheck className="size-4" />}
                {t('admin.approve')}
              </Button>
              <Button
                variant="outline"
                data-tone="danger"
                size="sm"
                disabled={busyId === d.id}
                title={t('admin.rejectTitle')}
                onClick={async () => {
                  if (
                    await confirm({
                      message: t('admin.rejectConfirm', {
                        name: d.name,
                        email: d.email ? ` (${d.email})` : '',
                      }),
                      danger: true,
                      confirmLabel: t('admin.reject'),
                    })
                  )
                    onReject(d.id);
                }}
              >
                <UserX className="size-4" />
                {t('admin.reject')}
              </Button>
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
