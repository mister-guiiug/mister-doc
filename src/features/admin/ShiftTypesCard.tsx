import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Plus, Loader2 } from 'lucide-react';
import {
  listShiftTypes,
  adminUpsertShiftType,
  adminSetShiftTypeActive,
  adminReorderShiftTypes,
  adminDeleteShiftType,
} from '../../backend/shiftTypes.ts';
import { setShiftTypes, type ShiftTypeDef } from '../../lib/shifts.ts';
import { SectionCard } from '../../components/ui/SectionCard.tsx';
import { Button } from '@mister-guiiug/dev-wpa-config/react/button';
import { useI18n } from '../../i18n/index.ts';
import { ShiftTypeRow } from './ShiftTypeRow.tsx';
import { ShiftTypeDialog } from './ShiftTypeDialog.tsx';
import { ErrorMessage } from '../../components/ui/ErrorMessage.tsx';

/** Modèle vierge d'un nouveau créneau (défauts raisonnables). */
function blankType(): ShiftTypeDef {
  return {
    code: '',
    label: '',
    hours: 8,
    clinical: true,
    isNight: false,
    weekend: true,
    sortOrder: 0,
    startTime: '08:00',
    endTime: '18:00',
    endDayOffset: 0,
    color: null,
    active: true,
  };
}

/**
 * Administration des types de créneaux (table `shift_types`). Permet de créer,
 * éditer, réordonner, (dés)activer et supprimer les créneaux — sans toucher au
 * code. Toute mutation rafraîchit la config locale ({@link setShiftTypes}) pour
 * un rendu immédiat, en plus de l'événement Realtime pour les autres sessions.
 *
 * Cette carte concentre l'état et les appels backend ; le rendu d'une ligne
 * ({@link ShiftTypeRow}) et le formulaire ({@link ShiftTypeDialog}) vivent dans
 * leurs propres fichiers, pour garder chaque module lisible.
 */
export function ShiftTypesCard() {
  const { t: tr } = useI18n();
  const [types, setTypes] = useState<ShiftTypeDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<{
    def: ShiftTypeDef;
    isNew: boolean;
  } | null>(null);

  const reload = useCallback(async () => {
    const list = await listShiftTypes();
    setTypes(list);
    setShiftTypes(list); // rafraîchit la config de l'app pour cette session
  }, []);

  useEffect(() => {
    reload()
      .catch(e => setError(e instanceof Error ? e.message : tr('common.error')))
      .finally(() => setLoading(false));
  }, [reload, tr]);

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('common.error'));
    } finally {
      setBusy(null);
    }
  }

  async function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= types.length) return;
    const current = types[index];
    const codes = types.map(t => t.code);
    const a = codes[index];
    const b = codes[target];
    if (!current || a === undefined || b === undefined) return;
    codes[index] = b;
    codes[target] = a;
    await run(`move:${current.code}`, () => adminReorderShiftTypes(codes));
  }

  if (loading)
    return (
      <SectionCard
        title={tr('shiftTypes.title')}
        icon={<CalendarClock className="size-4" />}
      >
        <p className="py-3 text-center text-sm text-slate-400">
          <Loader2 className="inline size-4 animate-spin" />
        </p>
      </SectionCard>
    );

  return (
    <SectionCard
      title={tr('shiftTypes.title')}
      icon={<CalendarClock className="size-4" />}
      desc={tr('shiftTypes.desc')}
      headerRight={
        <Button
          size="sm"
          onClick={() => setEditing({ def: blankType(), isNew: true })}
        >
          <Plus className="size-4" /> {tr('shiftTypes.add')}
        </Button>
      }
    >
      {error && <ErrorMessage className="mb-2">{error}</ErrorMessage>}

      <ul className="flex flex-col gap-2">
        {types.map((t, i) => (
          <ShiftTypeRow
            key={t.code}
            def={t}
            isFirst={i === 0}
            isLast={i === types.length - 1}
            busy={busy}
            onMove={dir => void move(i, dir)}
            onEdit={() => setEditing({ def: t, isNew: false })}
            onToggleActive={() =>
              void run(`toggle:${t.code}`, () =>
                adminSetShiftTypeActive(t.code, !t.active)
              )
            }
            onDelete={() =>
              void run(`del:${t.code}`, () => adminDeleteShiftType(t.code))
            }
          />
        ))}
      </ul>

      {editing && (
        <ShiftTypeDialog
          def={editing.def}
          isNew={editing.isNew}
          existingCodes={types.map(t => t.code)}
          onSave={async def => {
            await run(`save:${def.code}`, () => adminUpsertShiftType(def));
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </SectionCard>
  );
}
