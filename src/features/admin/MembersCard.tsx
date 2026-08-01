import {
  KeyRound,
  Loader2,
  Pencil,
  Shield,
  ShieldOff,
  Trash2,
  UserX,
} from 'lucide-react';
import type { Doctor } from '../../backend/types.ts';
import { SectionCard } from '../../components/ui/SectionCard.tsx';
import { useConfirm } from '../../components/ui/confirmContext.ts';
import { useI18n } from '../../i18n/index.ts';
import { Dot } from './Dot.tsx';

/**
 * Liste des médecins : membres approuvés puis entrées « roster » sans compte.
 * Chaque ligne expose les actions d'administration (renommer, admin, reset 2FA,
 * anonymiser, supprimer) ; les confirmations sont gérées ici, les mutations
 * dans AdminPanel.
 */
export function MembersCard({
  members,
  roster,
  selfId,
  busyId,
  onEdit,
  onToggleAdmin,
  onResetMfa,
  onAnonymize,
  onRemoveRoster,
}: {
  members: Doctor[];
  roster: Doctor[];
  selfId: string | undefined;
  busyId: string | null;
  onEdit: (doctor: Doctor) => void;
  onToggleAdmin: (doctor: Doctor) => void;
  onResetMfa: (id: string) => void;
  onAnonymize: (id: string) => void;
  onRemoveRoster: (id: string) => void;
}) {
  const confirm = useConfirm();
  const { t } = useI18n();

  return (
    <SectionCard
      title={t('admin.membersTitle')}
      icon={<Shield className="size-4" />}
      count={members.length + roster.length}
    >
      <ul className="flex flex-col gap-2">
        {[...members, ...roster.filter(r => !r.approved)].map(d => {
          const isSelf = d.id === selfId;
          const hasAccount = !!d.auth_id;
          return (
            <li
              key={d.id}
              className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 dark:border-slate-700"
            >
              <Dot color={d.color} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {d.name}
                  {d.is_admin && (
                    <span className="ml-2 rounded bg-teal-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-teal-700 dark:bg-teal-900/50 dark:text-teal-300">
                      {t('admin.adminBadge')}
                    </span>
                  )}
                  {!hasAccount && (
                    <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-700">
                      {t('admin.rosterBadge')}
                    </span>
                  )}
                </p>
                {d.email && (
                  <p className="truncate text-xs text-slate-400">{d.email}</p>
                )}
              </div>

              <button
                onClick={() => onEdit(d)}
                title={t('admin.rename')}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <Pencil className="size-4" />
              </button>

              {hasAccount && !isSelf && (
                <button
                  disabled={busyId === d.id}
                  onClick={() => onToggleAdmin(d)}
                  title={
                    d.is_admin ? t('admin.removeAdmin') : t('admin.makeAdmin')
                  }
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  {d.is_admin ? (
                    <ShieldOff className="size-4" />
                  ) : (
                    <Shield className="size-4" />
                  )}
                </button>
              )}

              {hasAccount && !isSelf && (
                <button
                  disabled={busyId === d.id}
                  onClick={async () => {
                    if (
                      await confirm({
                        title: t('admin.resetMfaConfirmTitle', {
                          name: d.name,
                        }),
                        message: t('admin.resetMfaConfirmMsg'),
                        confirmLabel: t('admin.resetMfaLabel'),
                      })
                    )
                      onResetMfa(d.id);
                  }}
                  title={t('admin.resetMfaTitle')}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <KeyRound className="size-4" />
                </button>
              )}

              {hasAccount && !isSelf && (
                <button
                  disabled={busyId === d.id}
                  onClick={async () => {
                    if (
                      await confirm({
                        title: t('admin.anonymizeConfirmTitle', {
                          name: d.name,
                        }),
                        message: t('admin.anonymizeConfirmMsg'),
                        danger: true,
                        confirmLabel: t('admin.anonymizeLabel'),
                      })
                    )
                      onAnonymize(d.id);
                  }}
                  title={t('admin.anonymizeTitle')}
                  className="rounded-lg p-1.5 text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  {busyId === d.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <UserX className="size-4" />
                  )}
                </button>
              )}

              {!hasAccount && (
                <button
                  disabled={busyId === d.id}
                  onClick={async () => {
                    if (
                      await confirm({
                        message: t('admin.removeRosterConfirm', {
                          name: d.name,
                        }),
                        danger: true,
                        confirmLabel: t('admin.removeRosterLabel'),
                      })
                    )
                      onRemoveRoster(d.id);
                  }}
                  title={t('admin.removeRosterTitle')}
                  className="rounded-lg p-1.5 text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  {busyId === d.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}
