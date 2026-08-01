import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  RefreshCw,
  Lock,
  LockOpen,
  Eye,
  List,
  LayoutGrid,
  FileDown,
} from 'lucide-react';
import { useI18n } from '../../i18n/index.ts';
import type { Doctor } from '../../backend/types.ts';

interface PlanningToolbarProps {
  /** Libellé du mois affiché (déjà localisé, ex. « août 2026 »). */
  monthTitle: string;
  locked: boolean;
  isAdmin: boolean;
  doctors: Doctor[];
  highlightId: string | null;
  view: 'list' | 'grid';
  refreshing: boolean;
  /** Décalage relatif de mois (-1 = précédent, +1 = suivant). */
  onShiftMonth: (delta: number) => void;
  onToday: () => void;
  onHighlightChange: (doctorId: string | null) => void;
  onToggleLock: () => void;
  onChangeView: (v: 'list' | 'grid') => void;
  onExportPdf: () => void;
  onRefresh: () => void;
}

/**
 * Barre d'outils du planning : navigation de mois, retour à aujourd'hui,
 * surlignage d'un médecin, verrou du mois (admin), bascule liste/grille,
 * export PDF et rafraîchissement. Purement présentationnelle — tout l'état
 * reste dans `PlanningView`.
 */
export function PlanningToolbar({
  monthTitle,
  locked,
  isAdmin,
  doctors,
  highlightId,
  view,
  refreshing,
  onShiftMonth,
  onToday,
  onHighlightChange,
  onToggleLock,
  onChangeView,
  onExportPdf,
  onRefresh,
}: PlanningToolbarProps) {
  const { t } = useI18n();

  return (
    <div className="print-hide flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
        <button
          onClick={() => onShiftMonth(-1)}
          className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label={t('common.prevMonth')}
        >
          <ChevronLeft className="size-5" />
        </button>
        <span className="flex min-w-32 items-center justify-center gap-2 px-1 text-sm font-semibold capitalize sm:min-w-40 sm:text-base">
          <CalendarDays className="size-4 shrink-0 text-teal-600" />
          {monthTitle}
          {locked && <Lock className="size-4 text-slate-400" />}
        </span>
        <button
          onClick={() => onShiftMonth(1)}
          className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label={t('common.nextMonth')}
        >
          <ChevronRight className="size-5" />
        </button>
      </div>
      <button
        onClick={onToday}
        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
      >
        {t('common.today')}
      </button>

      <label className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-800 dark:bg-slate-900">
        <Eye className="size-4 text-slate-400" />
        <select
          value={highlightId ?? ''}
          onChange={e => onHighlightChange(e.target.value || null)}
          className="max-w-28 bg-transparent text-sm outline-none"
          aria-label={t('planning.highlightDoctor')}
        >
          <option value="">{t('common.all')}</option>
          {doctors.map(d => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>

      {isAdmin && (
        <button
          onClick={onToggleLock}
          className={`flex items-center gap-1 rounded-xl border px-3 py-2 text-sm font-medium ${
            locked
              ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
              : 'border-slate-200 bg-white hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800'
          }`}
        >
          {locked ? (
            <LockOpen className="size-4" />
          ) : (
            <Lock className="size-4" />
          )}
          <span className="hidden sm:inline">
            {locked ? t('planning.unlock') : t('planning.lock')}
          </span>
        </button>
      )}

      <div className="ml-auto flex items-center gap-2">
        {/* Bascule liste / grille (desktop uniquement — la grille 7 colonnes
            n'a pas de sens sur petit écran). */}
        <div className="hidden items-center rounded-xl border border-slate-200 bg-white p-1 lg:flex dark:border-slate-800 dark:bg-slate-900">
          <button
            onClick={() => onChangeView('list')}
            aria-pressed={view === 'list'}
            title={t('planning.listViewTitle')}
            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium transition ${
              view === 'list'
                ? 'bg-teal-700 text-white'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <List className="size-4" /> {t('planning.list')}
          </button>
          <button
            onClick={() => onChangeView('grid')}
            aria-pressed={view === 'grid'}
            title={t('planning.gridViewTitle')}
            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium transition ${
              view === 'grid'
                ? 'bg-teal-700 text-white'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <LayoutGrid className="size-4" /> {t('planning.grid')}
          </button>
        </div>
        <button
          onClick={onExportPdf}
          title={t('planning.exportPdfTitle')}
          className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
        >
          <FileDown className="size-4" /> {t('counters.pdf')}
        </button>
        <button
          onClick={onRefresh}
          className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
          aria-label={t('planning.refresh')}
          title={t('planning.refresh')}
        >
          <RefreshCw className={`size-5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>
  );
}
