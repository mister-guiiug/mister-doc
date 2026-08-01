import { AlarmClock, Settings } from 'lucide-react';
import { Button } from '../../components/ui/Button.tsx';
import { SectionCard } from '../../components/ui/SectionCard.tsx';
import { useI18n } from '../../i18n/index.ts';

/**
 * Réglages globaux du planning : prise en compte du Lundi de Pentecôte comme
 * férié et envoi manuel des rappels. Composant de présentation — l'état et les
 * appels backend (settings, rappels) restent dans AdminPanel.
 */
export function AdminSettingsCard({
  pentecoteFerie,
  onTogglePentecote,
  reminderBusy,
  reminderMsg,
  onSendReminders,
}: {
  pentecoteFerie: boolean;
  onTogglePentecote: (checked: boolean) => void;
  reminderBusy: boolean;
  reminderMsg: string | null;
  onSendReminders: () => void;
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
          onClick={onSendReminders}
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
    </SectionCard>
  );
}
