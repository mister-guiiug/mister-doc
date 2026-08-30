import { useEffect, useState } from 'react';
import { Check, Palette, UserRound } from 'lucide-react';
import { useAuth } from '../../auth/useAuth.ts';
import { useI18n } from '../../i18n/index.ts';
import { useToast } from '@mister-guiiug/dev-wpa-config/react/toast';
import { Button } from '@mister-guiiug/dev-wpa-config/react/button';
import { SectionCard } from '../../components/ui/SectionCard.tsx';
import { DOCTOR_COLORS } from '../../lib/colors.ts';
import { updateMyProfile } from '../../backend/doctors.ts';
import type { Doctor } from '../../backend/types.ts';

/**
 * Identité du médecin connecté : nom affiché et couleur de pastille. Le bouton
 * n'est actif que si le formulaire diverge de la fiche enregistrée (`dirty`).
 */
export function IdentityCard({ doctor }: { doctor: Doctor }) {
  const { refreshDoctor } = useAuth();
  const { t } = useI18n();
  const toast = useToast();
  const [name, setName] = useState(doctor.name);
  const [color, setColor] = useState<string>(doctor.color);
  const [saving, setSaving] = useState(false);

  // Resynchronise si la fiche change (approbation, édition admin…).
  useEffect(() => {
    setName(doctor.name);
    setColor(doctor.color);
  }, [doctor]);

  const dirty = name.trim() !== doctor.name || color !== doctor.color;

  async function handleSave() {
    if (!dirty || !name.trim()) return;
    setSaving(true);
    try {
      await updateMyProfile(name.trim(), color);
      await refreshDoctor();
      toast.success(t('profile.profileUpdated'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('common.error'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard
      icon={<UserRound className="size-4" />}
      title={t('profile.identityTitle')}
      desc={t('profile.identityDesc')}
    >
      <label className="mb-3 flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-600 dark:text-slate-300">
          {t('profile.displayName')}
        </span>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={t('profile.namePlaceholder')}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 dark:border-slate-600 dark:bg-slate-800"
        />
      </label>

      <div className="mb-4 flex items-center gap-2">
        <Palette className="size-4 shrink-0 text-slate-400" />
        <div className="flex flex-wrap gap-2">
          {DOCTOR_COLORS.map(c => (
            <button
              type="button"
              key={c}
              onClick={() => setColor(c)}
              className={`grid size-7 place-items-center rounded-full transition ${
                color === c
                  ? 'ring-2 ring-slate-400 ring-offset-2 dark:ring-offset-slate-900'
                  : ''
              }`}
              style={{ backgroundColor: c }}
              aria-label={t('profile.colorAria', { color: c })}
            >
              {color === c && <Check className="size-4 text-white" />}
            </button>
          ))}
        </div>
      </div>

      <Button
        className="w-full py-2.5"
        loading={saving}
        disabled={!dirty || !name.trim()}
        onClick={() => void handleSave()}
      >
        {!saving && <Check className="size-4" />}
        {dirty ? t('common.save') : t('common.saved')}
      </Button>
    </SectionCard>
  );
}
