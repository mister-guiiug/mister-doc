import { useCallback, useEffect, useState } from 'react';
import {
  CalendarClock,
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  Moon,
  Loader2,
  X,
} from 'lucide-react';
import {
  listShiftTypes,
  adminUpsertShiftType,
  adminSetShiftTypeActive,
  adminReorderShiftTypes,
  adminDeleteShiftType,
} from '../../backend/shiftTypes.ts';
import { setShiftTypes, type ShiftTypeDef } from '../../lib/shifts.ts';
import { SectionCard } from '../../components/ui/SectionCard.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Badge } from '../../components/ui/Badge.tsx';
import { Field } from '../../components/ui/Field.tsx';
import { Modal } from '../../components/Modal.tsx';
import { useConfirm } from '../../components/ui/confirmContext.ts';
import { useI18n } from '../../i18n/index.ts';

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
 */
export function ShiftTypesCard() {
  const confirm = useConfirm();
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
      {error && (
        <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {types.map((t, i) => (
          <li
            key={t.code}
            className={`flex items-center gap-2 rounded-lg border border-slate-200 p-2 dark:border-slate-700 ${
              t.active ? '' : 'opacity-60'
            }`}
          >
            <span
              className="inline-block size-3 shrink-0 rounded-full"
              style={{ backgroundColor: t.color ?? '#94a3b8' }}
            />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-1.5 truncate text-sm font-medium">
                <span className="font-mono text-xs text-slate-400">
                  {t.code}
                </span>
                {t.label}
                <span className="text-xs font-normal text-slate-400">
                  · {t.hours} h
                </span>
                {t.isNight && (
                  <Badge size="xs" icon={<Moon className="size-3" />}>
                    {tr('shiftTypes.nightBadge')}
                  </Badge>
                )}
                {!t.clinical && (
                  <Badge size="xs">{tr('shiftTypes.nonClinicalBadge')}</Badge>
                )}
                {t.clinical && !t.weekend && (
                  <Badge size="xs">{tr('shiftTypes.weekBadge')}</Badge>
                )}
                {!t.active && (
                  <Badge size="xs">{tr('shiftTypes.inactiveBadge')}</Badge>
                )}
              </p>
            </div>

            <IconBtn
              title={tr('shiftTypes.up')}
              disabled={i === 0 || busy !== null}
              onClick={() => void move(i, -1)}
            >
              <ChevronUp className="size-4" />
            </IconBtn>
            <IconBtn
              title={tr('shiftTypes.down')}
              disabled={i === types.length - 1 || busy !== null}
              onClick={() => void move(i, 1)}
            >
              <ChevronDown className="size-4" />
            </IconBtn>
            <IconBtn
              title={tr('shiftTypes.edit')}
              disabled={busy !== null}
              onClick={() => setEditing({ def: t, isNew: false })}
            >
              <Pencil className="size-4" />
            </IconBtn>
            <IconBtn
              title={
                t.active
                  ? tr('shiftTypes.deactivate')
                  : tr('shiftTypes.activate')
              }
              disabled={busy !== null}
              onClick={() =>
                void run(`toggle:${t.code}`, () =>
                  adminSetShiftTypeActive(t.code, !t.active)
                )
              }
            >
              {busy === `toggle:${t.code}` ? (
                <Loader2 className="size-4 animate-spin" />
              ) : t.active ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </IconBtn>
            <button
              disabled={busy !== null}
              title={tr('shiftTypes.deleteTitle')}
              onClick={async () => {
                if (
                  await confirm({
                    message: tr('shiftTypes.deleteConfirm', {
                      label: t.label,
                      code: t.code,
                    }),
                    danger: true,
                    confirmLabel: tr('common.delete'),
                  })
                )
                  void run(`del:${t.code}`, () => adminDeleteShiftType(t.code));
              }}
              className="rounded-lg p-1.5 text-red-400 hover:bg-red-50 disabled:opacity-40 dark:hover:bg-red-950/30"
            >
              {busy === `del:${t.code}` ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
            </button>
          </li>
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

function IconBtn({
  title,
  disabled,
  onClick,
  children,
}: {
  title: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-700"
    >
      {children}
    </button>
  );
}

/** Dialogue de création / édition d'un type de créneau. */
function ShiftTypeDialog({
  def,
  isNew,
  existingCodes,
  onSave,
  onClose,
}: {
  def: ShiftTypeDef;
  isNew: boolean;
  existingCodes: string[];
  onSave: (def: ShiftTypeDef) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<ShiftTypeDef>(def);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof ShiftTypeDef>(k: K, v: ShiftTypeDef[K]) =>
    setDraft(d => ({ ...d, [k]: v }));

  const code = draft.code.trim().toUpperCase();
  const codeError =
    isNew && existingCodes.includes(code)
      ? t('shiftTypes.codeExists')
      : undefined;
  const valid =
    code.length > 0 &&
    draft.label.trim().length > 0 &&
    draft.hours >= 0 &&
    draft.hours <= 24 &&
    !codeError;

  async function submit() {
    if (!valid) return;
    setSaving(true);
    try {
      await onSave({ ...draft, code, label: draft.label.trim() });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} className="max-w-md rounded-t-2xl sm:rounded-2xl">
      <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-slate-800">
        <h3 className="font-semibold">
          {isNew
            ? t('shiftTypes.newTitle')
            : t('shiftTypes.editTitle', { code: def.code })}
        </h3>
        <button
          onClick={onClose}
          aria-label={t('common.close')}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="flex max-h-[70dvh] flex-col gap-3 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-3">
          <Field
            label={t('shiftTypes.code')}
            value={draft.code}
            disabled={!isNew}
            maxLength={8}
            placeholder="S1J"
            error={codeError}
            onChange={e => set('code', e.target.value.toUpperCase())}
          />
          <Field
            label={t('shiftTypes.hours')}
            type="number"
            min={0}
            max={24}
            step={0.5}
            value={draft.hours}
            onChange={e => set('hours', Number(e.target.value))}
          />
        </div>
        <Field
          label={t('shiftTypes.label')}
          value={draft.label}
          placeholder="S1 Jour"
          onChange={e => set('label', e.target.value)}
        />

        <fieldset className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <Check
            label={t('shiftTypes.clinicalCheck')}
            checked={draft.clinical}
            onChange={v => set('clinical', v)}
          />
          <Check
            label={t('shiftTypes.weekendCheck')}
            checked={draft.weekend}
            onChange={v => set('weekend', v)}
          />
          <Check
            label={t('shiftTypes.nightCheck')}
            checked={draft.isNight}
            onChange={v => set('isNight', v)}
          />
          <Check
            label={t('shiftTypes.activeCheck')}
            checked={draft.active}
            onChange={v => set('active', v)}
          />
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label={t('shiftTypes.startIcs')}
            type="time"
            value={draft.startTime ?? ''}
            onChange={e => set('startTime', e.target.value || null)}
          />
          <Field
            label={t('shiftTypes.endIcs')}
            type="time"
            value={draft.endTime ?? ''}
            onChange={e => set('endTime', e.target.value || null)}
          />
        </div>
        <Check
          label={t('shiftTypes.endsNextDay')}
          checked={draft.endDayOffset === 1}
          onChange={v => set('endDayOffset', v ? 1 : 0)}
        />

        <label className="flex items-center gap-2 text-sm">
          <span className="font-medium text-slate-600 dark:text-slate-300">
            {t('shiftTypes.badgeColor')}
          </span>
          <input
            type="color"
            value={draft.color ?? '#94a3b8'}
            onChange={e => set('color', e.target.value)}
            className="h-8 w-12 rounded border border-slate-300 dark:border-slate-600"
          />
          {draft.color && (
            <button
              type="button"
              onClick={() => set('color', null)}
              className="text-xs text-slate-400 underline"
            >
              {t('shiftTypes.removeColor')}
            </button>
          )}
        </label>
      </div>

      <div className="flex justify-end gap-2 border-t border-slate-100 p-3 dark:border-slate-800">
        <Button variant="secondary" size="sm" onClick={onClose}>
          {t('shiftTypes.cancel')}
        </Button>
        <Button
          size="sm"
          loading={saving}
          disabled={!valid}
          onClick={() => void submit()}
        >
          {t('shiftTypes.save')}
        </Button>
      </div>
    </Modal>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="mt-0.5 size-4 accent-teal-600"
      />
      <span>{label}</span>
    </label>
  );
}
