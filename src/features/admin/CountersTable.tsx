import { ChevronDown, ChevronUp } from 'lucide-react';
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

/**
 * Colonnes triables. `name` vise le nom du médecin ; toutes les autres clés
 * sont volontairement les noms exacts des champs numériques de `Row`, ce qui
 * permet au comparateur d'indexer la ligne sans table de correspondance.
 */
export type SortKey =
  | 'name'
  | 'fridays'
  | 'saturdays'
  | 'sundays'
  | 'weekendHours'
  | 'hncHours'
  | 'totalHours'
  | 'annualDays'
  | 'trainingHours';

export type SortDir = 'asc' | 'desc';

/** Colonne triée + sens. Piloté par le parent (voir `AllCounters`). */
export interface SortState {
  key: SortKey;
  dir: SortDir;
}

interface CountersTableProps {
  rows: Row[];
  /** Libellé de la période affichée, repris dans la note de bas de tableau. */
  label: string;
  /** Tri courant, appliqué en amont sur `rows` : sert ici à l'affichage seul. */
  sort: SortState;
  /** Clic sur un en-tête ; le parent décide du sens (bascule ou sens initial). */
  onSortChange: (key: SortKey) => void;
}

/** Vue « Tableau » : un médecin par ligne, compteurs de la période. */
export function CountersTable({
  rows,
  label,
  sort,
  onSortChange,
}: CountersTableProps) {
  const { t } = useI18n();
  // Props communes à tous les en-têtes : évite de répéter le tri sur 9 colonnes.
  const th = { sort, onSortChange };
  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-400 dark:border-slate-800">
              <Th
                {...th}
                sortKey="name"
                align="left"
                label={t('counters.doctor')}
              />
              <Th {...th} sortKey="fridays" label={t('counters.fri')} />
              <Th {...th} sortKey="saturdays" label={t('counters.sat')} />
              <Th {...th} sortKey="sundays" label={t('counters.sun')} />
              <Th {...th} sortKey="weekendHours" label={t('counters.hWe')} />
              <Th {...th} sortKey="hncHours" label={t('counters.hnc')} />
              <Th {...th} sortKey="totalHours" label={t('counters.hTotal')} />
              <Th
                {...th}
                sortKey="annualDays"
                label={t('counters.leaveShort')}
              />
              <Th
                {...th}
                sortKey="trainingHours"
                label={t('counters.trainingShort')}
              />
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

/**
 * En-tête de colonne triable. Le déclencheur est un vrai `<button>` (et non un
 * `<th onClick>`) pour rester atteignable au clavier et correctement annoncé ;
 * l'état du tri est porté par `aria-sort` sur le `<th>`, comme attendu par les
 * lecteurs d'écran et par l'audit axe.
 */
function Th({
  label,
  sortKey,
  sort,
  onSortChange,
  align = 'right',
}: {
  label: string;
  sortKey: SortKey;
  sort: SortState;
  onSortChange: (key: SortKey) => void;
  align?: 'left' | 'right';
}) {
  const { t } = useI18n();
  const active = sort.key === sortKey;
  const asc = sort.dir === 'asc';
  // Une seule colonne porte un sens de tri à la fois ; les autres restent
  // explicitement « none », ce qui les signale comme triables elles aussi.
  const ariaSort = active ? (asc ? 'ascending' : 'descending') : 'none';
  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className={`py-2 font-semibold ${align === 'left' ? 'px-3 text-left' : 'px-2 text-right'}`}
    >
      <button
        type="button"
        onClick={() => onSortChange(sortKey)}
        // Le libellé visible (abrégé, ex. « h WE ») est repris tel quel dans le
        // nom accessible, condition du critère WCAG « label in name ».
        aria-label={t('counters.sortBy', { column: label })}
        className={`inline-flex cursor-pointer items-center gap-1 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40 ${
          active
            ? 'text-teal-600 dark:text-teal-300'
            : 'hover:text-slate-600 dark:hover:text-slate-200'
        }`}
      >
        {label}
        {/* Emplacement réservé en permanence : changer de colonne triée ne
            décale pas la largeur des en-têtes. */}
        <span
          aria-hidden="true"
          className="inline-flex size-3.5 shrink-0 items-center justify-center"
        >
          {active &&
            (asc ? (
              <ChevronUp className="size-3.5" />
            ) : (
              <ChevronDown className="size-3.5" />
            ))}
        </span>
      </button>
    </th>
  );
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
