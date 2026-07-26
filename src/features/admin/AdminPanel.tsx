import { useCallback, useEffect, useState } from 'react';
import {
  UserCheck,
  UserPlus,
  UserX,
  Shield,
  ShieldOff,
  Trash2,
  Clock,
  Loader2,
  Pencil,
  Settings,
  KeyRound,
  AlarmClock,
} from 'lucide-react';
import { useAuth } from '../../auth/useAuth.ts';
import type { AppSettings, Doctor } from '../../backend/types.ts';
import {
  adminAddRoster,
  adminDeleteDoctor,
  adminRejectDoctor,
  adminResetMfa,
  adminSetDoctor,
  adminUpdateDoctor,
  anonymizeDoctor,
  listDoctors,
} from '../../backend/doctors.ts';
import {
  getSettings,
  setSettings as saveSettings,
} from '../../backend/settings.ts';
import { sendReminders } from '../../backend/reminders.ts';
import { setIncludePentecote } from '../../lib/dates.ts';
import { FullScreenSpinner } from '../../components/Spinner.tsx';
import { ProfileDialog } from '../../components/ProfileDialog.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { EmptyState } from '../../components/ui/EmptyState.tsx';
import { SectionCard } from '../../components/ui/SectionCard.tsx';
import { useConfirm } from '../../components/ui/confirmContext.ts';
import { useI18n } from '../../i18n/index.ts';
import { BackupCard } from './BackupCard.tsx';
import { ShiftTypesCard } from './ShiftTypesCard.tsx';
import { AuditLogCard } from './AuditLogCard.tsx';
import { DOCTOR_COLORS, DEFAULT_DOCTOR_COLOR } from '../../lib/colors.ts';

const COLORS = DOCTOR_COLORS;

export function AdminPanel() {
  const { doctor: self, refreshDoctor } = useAuth();
  const confirm = useConfirm();
  const { t } = useI18n();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<string>(DEFAULT_DOCTOR_COLOR);
  const [editDoc, setEditDoc] = useState<Doctor | null>(null);
  const [settings, setSettings] = useState<AppSettings>({});
  const [reminderBusy, setReminderBusy] = useState(false);
  const [reminderMsg, setReminderMsg] = useState<string | null>(null);

  useEffect(() => {
    getSettings()
      .then(setSettings)
      .catch(() => {});
  }, []);

  async function togglePentecote(checked: boolean) {
    const next = { ...settings, pentecote_ferie: checked };
    setSettings(next);
    setIncludePentecote(checked);
    try {
      await saveSettings(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    }
  }

  async function handleReminders() {
    setReminderBusy(true);
    setReminderMsg(null);
    try {
      const n = await sendReminders();
      setReminderMsg(
        n > 0 ? t('admin.remindersSent', { n }) : t('admin.remindersNone')
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setReminderBusy(false);
    }
  }

  const reload = useCallback(async () => {
    try {
      setDoctors(await listDoctors());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    }
  }, [t]);

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, [reload]);

  async function act(id: string, fn: () => Promise<unknown>) {
    setBusyId(id);
    setError(null);
    try {
      await fn();
      await reload();
      await refreshDoctor();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setBusyId(null);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    await act('new', async () => {
      await adminAddRoster(newName.trim(), newColor);
      setNewName('');
    });
  }

  if (loading) return <FullScreenSpinner label={t('common.loading')} />;

  const pending = doctors.filter(d => d.auth_id && !d.approved);
  const members = doctors.filter(d => d.approved);
  const roster = doctors.filter(d => !d.auth_id);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-4">
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      {/* Réglages */}
      <Card
        title={t('admin.settingsTitle')}
        icon={<Settings className="size-4" />}
      >
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={settings.pentecote_ferie !== false}
            onChange={e => void togglePentecote(e.target.checked)}
            className="mt-0.5 size-4 accent-teal-600"
          />
          <span>
            <span className="font-medium">{t('admin.pentecoteLabel')}</span>
            <span className="block text-xs text-slate-400">
              {t('admin.pentecoteDesc')}
            </span>
          </span>
        </label>

        <div className="mt-3 flex items-start justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
          <span className="text-sm">
            <span className="font-medium">{t('admin.remindersTitle')}</span>
            <span className="block text-xs text-slate-400">
              {t('admin.remindersDesc')}
            </span>
          </span>
          <Button
            size="sm"
            variant="secondary"
            loading={reminderBusy}
            onClick={() => void handleReminders()}
          >
            {!reminderBusy && <AlarmClock className="size-4" />}
            {t('admin.send')}
          </Button>
        </div>
        {reminderMsg && (
          <p className="mt-1 text-xs text-teal-600 dark:text-teal-400">
            {reminderMsg}
          </p>
        )}
      </Card>

      <ShiftTypesCard />

      <BackupCard />

      {/* Comptes en attente */}
      <Card
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
                  onClick={() =>
                    void act(d.id, () => adminSetDoctor(d.id, true, null))
                  }
                >
                  {busyId !== d.id && <UserCheck className="size-4" />}
                  {t('admin.approve')}
                </Button>
                <Button
                  variant="dangerGhost"
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
                      void act(d.id, () => adminRejectDoctor(d.id));
                  }}
                >
                  <UserX className="size-4" />
                  {t('admin.reject')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Ajouter au roster */}
      <Card
        title={t('admin.addRosterTitle')}
        icon={<UserPlus className="size-4" />}
      >
        <form onSubmit={handleAdd} className="flex flex-col gap-3">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder={t('admin.rosterNamePlaceholder')}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 dark:border-slate-600 dark:bg-slate-800"
          />
          <div className="flex flex-wrap items-center gap-2">
            {COLORS.map(c => (
              <button
                type="button"
                key={c}
                onClick={() => setNewColor(c)}
                className={`size-6 rounded-full transition ${
                  newColor === c ? 'ring-2 ring-offset-2 ring-slate-400' : ''
                }`}
                style={{ backgroundColor: c }}
                aria-label={t('profile.colorAria', { color: c })}
              />
            ))}
            <Button
              type="submit"
              size="sm"
              className="ml-auto"
              loading={busyId === 'new'}
              disabled={!newName.trim()}
            >
              {busyId !== 'new' && <UserPlus className="size-4" />}
              {t('admin.add')}
            </Button>
          </div>
          <p className="text-xs text-slate-400">{t('admin.rosterNote')}</p>
        </form>
      </Card>

      {/* Membres */}
      <Card
        title={t('admin.membersTitle')}
        icon={<Shield className="size-4" />}
        count={members.length + roster.length}
      >
        <ul className="flex flex-col gap-2">
          {[...members, ...roster.filter(r => !r.approved)].map(d => {
            const isSelf = d.id === self?.id;
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
                  onClick={() => setEditDoc(d)}
                  title={t('admin.rename')}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <Pencil className="size-4" />
                </button>

                {hasAccount && !isSelf && (
                  <button
                    disabled={busyId === d.id}
                    onClick={() =>
                      void act(d.id, () =>
                        adminSetDoctor(d.id, null, !d.is_admin)
                      )
                    }
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
                        void act(d.id, () => adminResetMfa(d.id));
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
                        void act(d.id, () => anonymizeDoctor(d.id));
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
                        void act(d.id, () => adminDeleteDoctor(d.id));
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
      </Card>

      <AuditLogCard />

      {editDoc && (
        <ProfileDialog
          title={t('admin.renameDialogTitle', { name: editDoc.name })}
          initialName={editDoc.name}
          initialColor={editDoc.color}
          onSave={async (name, color) => {
            await adminUpdateDoctor(editDoc.id, name, color);
            await reload();
            await refreshDoctor();
          }}
          onClose={() => setEditDoc(null)}
        />
      )}
    </div>
  );
}

function Card({
  title,
  icon,
  count,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <SectionCard title={title} icon={icon} count={count}>
      {children}
    </SectionCard>
  );
}

function Dot({ color }: { color: string }) {
  return (
    <span
      className="inline-block size-3 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
    />
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <EmptyState className="py-4">{children}</EmptyState>;
}
