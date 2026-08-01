import { useI18n } from '../../i18n/index.ts';
import type { Doctor } from '../../backend/types.ts';

/** Compteurs d'un médecin agrégés sur la période affichée (ligne du tableau). */
export interface Row {
  doctor: Doctor;
  fridays: number;
  saturdays: number;
  sundays: number;
  weekendHours: number;
  hncHours: number;
  totalHours: number;
  annualDays: number;
  trainingHours: number;
}

interface CountersTableProps {
  rows: Row[];
  /** Libellé de la période affichée, repris dans la note de bas de tableau. */
  label: string;
}

/** Vue « Tableau » : un médecin par ligne, compteurs de la période. */
export function CountersTable({ rows, label }: CountersTableProps) {
  const { t } = useI18n();
  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-400 dark:border-slate-800">
              <th className="px-3 py-2 font-semibold">
                {t('counters.doctor')}
              </th>
              <Th>{t('counters.fri')}</Th>
              <Th>{t('counters.sat')}</Th>
              <Th>{t('counters.sun')}</Th>
              <Th>{t('counters.hWe')}</Th>
              <Th>{t('counters.hnc')}</Th>
              <Th>{t('counters.hTotal')}</Th>
              <Th>{t('counters.leaveShort')}</Th>
              <Th>{t('counters.trainingShort')}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr
                key={r.doctor.id}
                className="border-b border-slate-50 last:border-0 dark:border-slate-800/60"
              >
                <td className="px-3 py-2">
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: r.doctor.color }}
                    />
                    <span className="truncate font-medium">
                      {r.doctor.name}
                    </span>
                  </span>
                </td>
                <Td>{r.fridays}</Td>
                <Td>{r.saturdays}</Td>
                <Td>{r.sundays}</Td>
                <Td strong>{r.weekendHours} h</Td>
                <Td>{r.hncHours} h</Td>
                <Td strong>{r.totalHours} h</Td>
                <Td>{r.annualDays} j</Td>
                <Td>{r.trainingHours} h</Td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="px-3 py-6 text-center text-slate-400"
                >
                  {t('counters.noDoctors')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">
        {t('counters.weekendNote', { label })}
      </p>
    </>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-2 py-2 text-right font-semibold">{children}</th>;
}
function Td({
  children,
  strong,
}: {
  children: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <td
      className={`px-2 py-2 text-right tabular-nums ${strong ? 'font-semibold text-teal-700 dark:text-teal-300' : ''}`}
    >
      {children}
    </td>
  );
}
