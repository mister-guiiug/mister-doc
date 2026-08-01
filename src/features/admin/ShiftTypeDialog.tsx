import { useState } from 'react';
import { X } from 'lucide-react';
import type { ShiftTypeDef } from '../../lib/shifts.ts';
import { Button } from '../../components/ui/Button.tsx';
import { Field } from '../../components/ui/Field.tsx';
import { Modal } from '../../components/Modal.tsx';
import { useI18n } from '../../i18n/index.ts';

interface ShiftTypeDialogProps {
  def: ShiftTypeDef;
  isNew: boolean;
  /** Codes déjà pris : sert à refuser un doublon à la création. */
  existingCodes: string[];
  onSave: (def: ShiftTypeDef) => Promise<void>;
  onClose: () => void;
}

/**
 * Dialogue de création / édition d'un type de créneau. Purement
 * présentationnel : il travaille sur un brouillon local et délègue la
 * persistance à `onSave`, la carte parente restant seule à parler au backend.
 */
export function ShiftTypeDialog({
  def,
  isNew,
  existingCodes,
  onSave,
  onClose,
}: ShiftTypeDialogProps) {
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
