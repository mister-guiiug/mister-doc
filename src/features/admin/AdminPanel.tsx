import { useCallback, useEffect, useState } from 'react';
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
import { sendReminders, sendWeeklyDigest } from '../../backend/reminders.ts';
import { setIncludePentecote } from '../../lib/dates.ts';
import { FullScreenSpinner } from '../../components/Spinner.tsx';
import { ProfileDialog } from '../../components/ProfileDialog.tsx';
import { useI18n } from '../../i18n/index.ts';
import { BackupCard } from './BackupCard.tsx';
import { ShiftTypesCard } from './ShiftTypesCard.tsx';
import { AuditLogCard } from './AuditLogCard.tsx';
import { AdminSettingsCard } from './AdminSettingsCard.tsx';
import { PendingAccountsCard } from './PendingAccountsCard.tsx';
import { AddRosterCard } from './AddRosterCard.tsx';
import { MembersCard } from './MembersCard.tsx';
import { DEFAULT_DOCTOR_COLOR } from '../../lib/colors.ts';
import { ErrorMessage } from '../../components/ui/ErrorMessage.tsx';

/**
 * Écran d'administration : orchestre l'état partagé (liste des médecins,
 * réglages, verrou d'action) et délègue chaque bloc à une carte dédiée.
 */
export function AdminPanel() {
  const { doctor: self, refreshDoctor } = useAuth();
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
  const [digestBusy, setDigestBusy] = useState(false);
  const [digestMsg, setDigestMsg] = useState<string | null>(null);

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

  async function handleDigest() {
    setDigestBusy(true);
    setDigestMsg(null);
    try {
      const n = await sendWeeklyDigest();
      setDigestMsg(
        n > 0 ? t('admin.digestSent', { n }) : t('admin.digestNone')
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setDigestBusy(false);
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
      {error && <ErrorMessage>{error}</ErrorMessage>}

      <AdminSettingsCard
        pentecoteFerie={settings.pentecote_ferie !== false}
        onTogglePentecote={checked => void togglePentecote(checked)}
        reminderBusy={reminderBusy}
        reminderMsg={reminderMsg}
        onSendReminders={() => void handleReminders()}
        digestBusy={digestBusy}
        digestMsg={digestMsg}
        onSendDigest={() => void handleDigest()}
      />

      <ShiftTypesCard />

      <BackupCard />

      <PendingAccountsCard
        pending={pending}
        busyId={busyId}
        onApprove={id => void act(id, () => adminSetDoctor(id, true, null))}
        onReject={id => void act(id, () => adminRejectDoctor(id))}
      />

      <AddRosterCard
        name={newName}
        color={newColor}
        busy={busyId === 'new'}
        onNameChange={setNewName}
        onColorChange={setNewColor}
        onSubmit={handleAdd}
      />

      <MembersCard
        members={members}
        roster={roster}
        selfId={self?.id}
        busyId={busyId}
        onEdit={setEditDoc}
        onToggleAdmin={d =>
          void act(d.id, () => adminSetDoctor(d.id, null, !d.is_admin))
        }
        onResetMfa={id => void act(id, () => adminResetMfa(id))}
        onAnonymize={id => void act(id, () => anonymizeDoctor(id))}
        onRemoveRoster={id => void act(id, () => adminDeleteDoctor(id))}
      />

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
