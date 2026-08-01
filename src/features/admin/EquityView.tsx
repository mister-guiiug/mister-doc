import { useI18n } from '../../i18n/index.ts';
import {
  EQUITY_METRICS,
  type EquityMetricKey,
  type EquityReport,
} from '../../lib/equity.ts';

/**
 * Vue « Équité » : charge comparée par médecin. Chaque barre est proportionnelle
 * au maximum de l'équipe pour l'indicateur, et l'écart à la moyenne est indiqué
 * (▲ au-dessus, ▼ en dessous) pour repérer les déséquilibres.
 */
export function EquityView({
  report,
  label,
}: {
  report: EquityReport;
  label: string;
}) {
  const { t } = useI18n();
  const rows = [...report.rows].sort(
    (a, b) => b.totalHours - a.totalHours || a.name.localeCompare(b.name)
  );
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
        {rows.map(r => (
          <div key={r.doctorId} className="flex flex-col gap-1.5 px-3 py-2.5">
            <span className="flex items-center gap-2 text-sm font-medium">
              <span
                className="inline-block size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: r.color ?? '#999' }}
              />
              <span className="truncate">{r.name}</span>
            </span>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
              {EQUITY_METRICS.map(m => (
                <EquityBar
                  key={m.key}
                  label={m.short}
                  value={r[m.key as EquityMetricKey]}
                  mean={report.mean[m.key]}
                  max={report.max[m.key]}
                />
              ))}
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-slate-400">
            {t('counters.noDoctors')}
          </p>
        )}
      </div>
      <p className="text-xs text-slate-400">
        {t('counters.equityNote', { label })}
      </p>
    </div>
  );
}

/** Une barre d'indicateur d'équité : valeur, jauge et écart à la moyenne. */
function EquityBar({
  label,
  value,
  mean,
  max,
}: {
  label: string;
  value: number;
  mean: number;
  max: number;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const delta = value - mean;
  const over = delta > 0.5;
  const under = delta < -0.5;
  const bar = over ? 'bg-amber-500' : under ? 'bg-teal-500' : 'bg-slate-400';
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-baseline justify-between text-[11px]">
        <span className="uppercase text-slate-400">{label}</span>
        <span className="tabular-nums">
          <span className="font-semibold">{value}</span>
          {(over || under) && (
            <span
              className={`ml-1 ${over ? 'text-amber-600' : 'text-teal-600'}`}
            >
              {over ? '▲' : '▼'} {Math.abs(Math.round(delta))}
            </span>
          )}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className={`h-full rounded-full ${bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
