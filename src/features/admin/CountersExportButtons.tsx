import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { useI18n } from '../../i18n/index.ts';
import {
  exportCountersCsv,
  exportCountersPdf,
  exportCountersXlsx,
  type CounterRow,
} from './countersExport.ts';

/**
 * Groupe d'actions d'export du tableau des compteurs (CSV / Excel / PDF).
 * Les trois formats partagent les mêmes lignes déjà agrégées par l'écran.
 */
export function CountersExportButtons({
  rows,
  label,
}: {
  rows: CounterRow[];
  label: string;
}) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
      <ExportButton
        onClick={() => exportCountersCsv(rows, label)}
        disabled={rows.length === 0}
        title={t('counters.exportCsv')}
        icon={<Download className="size-4" />}
        label={t('counters.csv')}
      />
      <ExportButton
        onClick={() => exportCountersXlsx(rows, label)}
        disabled={rows.length === 0}
        title={t('counters.exportExcel')}
        icon={<FileSpreadsheet className="size-4" />}
        label={t('counters.excel')}
      />
      <ExportButton
        onClick={() => exportCountersPdf(rows, label)}
        disabled={rows.length === 0}
        title={t('counters.exportPdf')}
        icon={<FileText className="size-4" />}
        label={t('counters.pdf')}
      />
    </div>
  );
}

/** Bouton d'export compact (CSV / Excel / PDF) du groupe d'actions. */
function ExportButton({
  onClick,
  disabled,
  title,
  icon,
  label,
}: {
  onClick: () => void;
  disabled?: boolean;
  title: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium transition hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent dark:hover:bg-slate-800"
    >
      {icon} {label}
    </button>
  );
}
