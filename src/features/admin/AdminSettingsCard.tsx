import { AlarmClock, CalendarRange, Settings } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@mister-guiiug/dev-wpa-config/react/button';
import { SectionCard } from '../../components/ui/SectionCard.tsx';
import { useI18n } from '../../i18n/index.ts';

/**
 * Réglages globaux du planning : prise en compte du Lundi de Pentecôte comme
 * férié, et déclenchement manuel des envois programmés (rappels quotidiens,
 * récapitulatif hebdomadaire). Composant de présentation — l'état et les appels
 * backend restent dans AdminPanel.
 */
export function AdminSettingsCard({
  pentecoteFerie,
  onTogglePentecote,
  reminderBusy,
  reminderMsg,
  onSendReminders,
  digestBusy,
  digestMsg,
  onSendDigest,
}: {
  pentecoteFerie: boolean;
  onTogglePentecote: (checked: boolean) => void;
  reminderBusy: boolean;
  reminderMsg: string | null;
  onSendReminders: () => void;
  digestBusy: boolean;
  digestMsg: string | null;
  onSendDigest: () => void;
}) {
  const { t } = useI18n();

  return (
    <SectionCard
      title={t('admin.settingsTitle')}
      icon={<Settings className="size-4" />}
    >
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={pentecoteFerie}
          onChange={e => onTogglePentecote(e.target.checked)}
          className="mt-0.5 size-4 accent-teal-600"
        />
        <span>
          <span className="font-medium">{t('admin.pentecoteLabel')}</span>
          <span className="block text-xs text-slate-400">
            {t('admin.pentecoteDesc')}
          </span>
        </span>
      </label>

      <ManualSend
        title={t('admin.remindersTitle')}
        desc={t('admin.remindersDesc')}
        icon={<AlarmClock className="size-4" />}
        label={t('admin.send')}
        busy={reminderBusy}
        message={reminderMsg}
        onSend={onSendReminders}
      />

      <ManualSend
        title={t('admin.digestTitle')}
        desc={t('admin.digestDesc')}
        icon={<CalendarRange className="size-4" />}
        label={t('admin.send')}
        busy={digestBusy}
        message={digestMsg}
        onSend={onSendDigest}
      />
    </SectionCard>
  );
}

/**
 * Ligne « envoi programmé » : intitulé, explication, bouton de déclenchement
 * manuel et compte rendu. Les rappels et le récapitulatif partagent exactement
 * cette mise en forme — un seul rendu évite qu'ils divergent.
 */
function ManualSend({
  title,
  desc,
  icon,
  label,
  busy,
  message,
  onSend,
}: {
  title: string;
  desc: string;
  icon: ReactNode;
  label: string;
  busy: boolean;
  message: string | null;
  onSend: () => void;
}) {
  return (
    <>
      <div className="mt-3 flex items-start justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
        <span className="text-sm">
          <span className="font-medium">{title}</span>
          <span className="block text-xs text-slate-400">{desc}</span>
        </span>
        <Button size="sm" variant="secondary" loading={busy} onClick={onSend}>
          {!busy && icon}
          {label}
        </Button>
      </div>
      {message && (
        <p className="mt-1 text-xs text-teal-600 dark:text-teal-400">
          {message}
        </p>
      )}
    </>
  );
}
