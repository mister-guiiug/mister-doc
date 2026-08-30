import { UserPlus } from 'lucide-react';
import { Button } from '@mister-guiiug/dev-wpa-config/react/button';
import { SectionCard } from '../../components/ui/SectionCard.tsx';
import { useI18n } from '../../i18n/index.ts';
import { DOCTOR_COLORS } from '../../lib/colors.ts';

const COLORS = DOCTOR_COLORS;

/**
 * Ajout d'un médecin « roster » (sans compte) : nom + couleur de pastille.
 * Le formulaire est piloté par AdminPanel, qui détient l'état saisi et
 * déclenche la mutation.
 */
export function AddRosterCard({
  name,
  color,
  busy,
  onNameChange,
  onColorChange,
  onSubmit,
}: {
  name: string;
  color: string;
  busy: boolean;
  onNameChange: (name: string) => void;
  onColorChange: (color: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const { t } = useI18n();

  return (
    <SectionCard
      title={t('admin.addRosterTitle')}
      icon={<UserPlus className="size-4" />}
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <input
          value={name}
          onChange={e => onNameChange(e.target.value)}
          placeholder={t('admin.rosterNamePlaceholder')}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 dark:border-slate-600 dark:bg-slate-800"
        />
        <div className="flex flex-wrap items-center gap-2">
          {COLORS.map(c => (
            <button
              type="button"
              key={c}
              onClick={() => onColorChange(c)}
              className={`size-6 rounded-full transition ${
                color === c ? 'ring-2 ring-offset-2 ring-slate-400' : ''
              }`}
              style={{ backgroundColor: c }}
              aria-label={t('profile.colorAria', { color: c })}
            />
          ))}
          <Button
            type="submit"
            size="sm"
            className="ml-auto"
            loading={busy}
            disabled={!name.trim()}
          >
            {!busy && <UserPlus className="size-4" />}
            {t('admin.add')}
          </Button>
        </div>
        <p className="text-xs text-slate-400">{t('admin.rosterNote')}</p>
      </form>
    </SectionCard>
  );
}
