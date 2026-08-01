import {
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  Moon,
  Loader2,
} from 'lucide-react';
import type { ShiftTypeDef } from '../../lib/shifts.ts';
import { Badge } from '../../components/ui/Badge.tsx';
import { useConfirm } from '../../components/ui/confirmContext.ts';
import { useI18n } from '../../i18n/index.ts';

interface ShiftTypeRowProps {
  def: ShiftTypeDef;
  /** Premier / dernier de la liste : désactive la flèche correspondante. */
  isFirst: boolean;
  isLast: boolean;
  /** Clé de l'action en cours côté carte (`toggle:CODE`, `del:CODE`, …). */
  busy: string | null;
  onMove: (dir: -1 | 1) => void;
  onEdit: () => void;
  onToggleActive: () => void;
  /** Appelé seulement après confirmation de l'utilisateur. */
  onDelete: () => void;
}

/**
 * Ligne de la liste des types de créneaux : résumé + actions (monter,
 * descendre, modifier, (dés)activer, supprimer). Présentationnel — les
 * mutations sont déléguées à la carte parente, qui seule appelle le backend.
 */
export function ShiftTypeRow({
  def,
  isFirst,
  isLast,
  busy,
  onMove,
  onEdit,
  onToggleActive,
  onDelete,
}: ShiftTypeRowProps) {
  const confirm = useConfirm();
  const { t } = useI18n();

  return (
    <li
      className={`flex items-center gap-2 rounded-lg border border-slate-200 p-2 dark:border-slate-700 ${
        def.active ? '' : 'opacity-60'
      }`}
    >
      <span
        className="inline-block size-3 shrink-0 rounded-full"
        style={{ backgroundColor: def.color ?? '#94a3b8' }}
      />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-1.5 truncate text-sm font-medium">
          <span className="font-mono text-xs text-slate-400">{def.code}</span>
          {def.label}
          <span className="text-xs font-normal text-slate-400">
            · {def.hours} h
          </span>
          {def.isNight && (
            <Badge size="xs" icon={<Moon className="size-3" />}>
              {t('shiftTypes.nightBadge')}
            </Badge>
          )}
          {!def.clinical && (
            <Badge size="xs">{t('shiftTypes.nonClinicalBadge')}</Badge>
          )}
          {def.clinical && !def.weekend && (
            <Badge size="xs">{t('shiftTypes.weekBadge')}</Badge>
          )}
          {!def.active && (
            <Badge size="xs">{t('shiftTypes.inactiveBadge')}</Badge>
          )}
        </p>
      </div>

      <IconBtn
        title={t('shiftTypes.up')}
        disabled={isFirst || busy !== null}
        onClick={() => onMove(-1)}
      >
        <ChevronUp className="size-4" />
      </IconBtn>
      <IconBtn
        title={t('shiftTypes.down')}
        disabled={isLast || busy !== null}
        onClick={() => onMove(1)}
      >
        <ChevronDown className="size-4" />
      </IconBtn>
      <IconBtn
        title={t('shiftTypes.edit')}
        disabled={busy !== null}
        onClick={onEdit}
      >
        <Pencil className="size-4" />
      </IconBtn>
      <IconBtn
        title={
          def.active ? t('shiftTypes.deactivate') : t('shiftTypes.activate')
        }
        disabled={busy !== null}
        onClick={onToggleActive}
      >
        {busy === `toggle:${def.code}` ? (
          <Loader2 className="size-4 animate-spin" />
        ) : def.active ? (
          <EyeOff className="size-4" />
        ) : (
          <Eye className="size-4" />
        )}
      </IconBtn>
      <button
        disabled={busy !== null}
        title={t('shiftTypes.deleteTitle')}
        onClick={async () => {
          if (
            await confirm({
              message: t('shiftTypes.deleteConfirm', {
                label: def.label,
                code: def.code,
              }),
              danger: true,
              confirmLabel: t('common.delete'),
            })
          )
            onDelete();
        }}
        className="rounded-lg p-1.5 text-red-400 hover:bg-red-50 disabled:opacity-40 dark:hover:bg-red-950/30"
      >
        {busy === `del:${def.code}` ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Trash2 className="size-4" />
        )}
      </button>
    </li>
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
