import { useI18n } from '../../i18n/index.ts';
import { weeksOfMonth, type MonthDay } from '../../lib/dates.ts';
import {
  shiftDef,
  shiftLabel,
  type CountableShift,
  type ShiftType,
} from '../../lib/shifts.ts';

/**
 * Fond/bordure teintés à partir de la couleur configurée du créneau. On dilue
 * la couleur au lieu de l'appliquer pleine : le numéro du jour garde ainsi son
 * contraste AA en clair comme en sombre, quelle que soit la couleur choisie par
 * l'admin. `color-mix` est déjà le socle des opacités de Tailwind v4 : aucune
 * exigence navigateur supplémentaire.
 */
function tint(color: string, percent: number): string {
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}

/** Repli quand le type de créneau n'a pas de couleur configurée (`color` nul). */
const NEUTRAL_DOT = 'bg-slate-400 dark:bg-slate-500';
const NEUTRAL_CELL =
  'border-slate-300 bg-slate-200/70 dark:border-slate-600 dark:bg-slate-700/60';

/** Pastille de couleur d'un type de créneau (case du calendrier ou légende). */
function CodeDot({ code, className }: { code: ShiftType; className: string }) {
  const color = shiftDef(code)?.color ?? null;
  return color ? (
    <span
      className={`block shrink-0 rounded-full ${className}`}
      style={{ backgroundColor: color }}
    />
  ) : (
    <span
      className={`block shrink-0 rounded-full ${NEUTRAL_DOT} ${className}`}
    />
  );
}

/**
 * Mini-calendrier du mois affiché (7 colonnes, lundi → dimanche) : les jours où
 * le médecin est de garde sont colorés selon le TYPE de créneau, les autres
 * restent neutres. Les couleurs viennent de la config des créneaux
 * (`shiftDef(code)?.color`) — jamais d'une palette codée en dur par code, les
 * types étant configurables par l'admin.
 *
 * `shifts` doit déjà être restreint au médecin ET au mois `year`/`month`
 * (l'appelant filtre : en portée « quadri. » ses données couvrent 4 mois).
 */
export function CountersCalendar({
  year,
  month,
  shifts,
}: {
  year: number;
  /** Mois 0-indexé, comme partout dans `lib/dates.ts`. */
  month: number;
  shifts: CountableShift[];
}) {
  const { t, m } = useI18n();

  /** Ordre d'affichage configuré (fallback stable si le code est inconnu). */
  const byConfigOrder = (a: ShiftType, b: ShiftType) =>
    (shiftDef(a)?.sortOrder ?? 0) - (shiftDef(b)?.sortOrder ?? 0) ||
    a.localeCompare(b);

  // Un même jour peut porter plusieurs créneaux (jour + nuit) : on indexe une
  // liste, en évitant les doublons de code. Elle est triée sur l'ordre de la
  // config pour que la teinte de la case ne dépende pas de l'ordre d'arrivée
  // des lignes.
  const byDate = new Map<string, ShiftType[]>();
  for (const s of shifts) {
    const list = byDate.get(s.work_date);
    if (!list) byDate.set(s.work_date, [s.shift_type]);
    else if (!list.includes(s.shift_type)) list.push(s.shift_type);
  }
  for (const list of byDate.values()) list.sort(byConfigOrder);

  // Découpage en semaines ISO fourni par `lib/dates.ts` (pas de recalcul de
  // calendrier ici) ; chaque semaine est projetée sur 7 colonnes fixes.
  const rows = weeksOfMonth(year, month).map(({ week, days }) => {
    const cells: (MonthDay | null)[] = Array<MonthDay | null>(7).fill(null);
    for (const d of days) cells[d.weekday] = d;
    return { week, cells };
  });

  // Légende : uniquement les types réellement présents dans le mois, dans
  // l'ordre d'affichage de la config.
  const present = [...new Set(shifts.map(s => s.shift_type))].sort(
    byConfigOrder
  );

  const period = `${m.common.months[month] ?? ''} ${year}`;

  return (
    <div>
      <table className="w-full table-fixed border-collapse">
        <caption className="sr-only">
          {t('counters.calendarCaption', { period })}
        </caption>
        <thead>
          <tr>
            {m.common.weekdaysShort.map((label, i) => (
              <th
                key={i}
                scope="col"
                className={`pb-1 text-[10px] font-semibold uppercase ${
                  i >= 5
                    ? 'text-teal-700 dark:text-teal-400'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ week, cells }) => (
            <tr key={week}>
              {cells.map((day, i) => {
                // Case de remplissage (avant le 1er, après le dernier jour du
                // mois) : sans contenu ni rôle, elle est masquée aux lecteurs
                // d'écran plutôt que d'être annoncée comme une cellule vide.
                if (!day) return <td key={`empty-${week}-${i}`} aria-hidden />;
                const codes = byDate.get(day.iso) ?? [];
                const onDuty = codes.length > 0;
                const first = codes[0];
                const color = first ? (shiftDef(first)?.color ?? null) : null;
                const labels = codes.map(c => shiftLabel(c)).join(' · ');
                const weekday = m.common.weekdays[day.weekday] ?? '';
                return (
                  <td key={day.iso} className="p-0.5 align-top">
                    <div
                      title={
                        onDuty
                          ? `${weekday} ${day.date.getDate()} — ${labels}`
                          : undefined
                      }
                      style={
                        onDuty && color
                          ? {
                              backgroundColor: tint(color, 24),
                              borderColor: tint(color, 60),
                            }
                          : undefined
                      }
                      className={`flex h-9 flex-col items-center justify-center gap-0.5 rounded-lg border text-[11px] leading-none tabular-nums ${
                        onDuty
                          ? `font-bold text-slate-900 dark:text-slate-50 ${color ? '' : NEUTRAL_CELL}`
                          : 'border-transparent text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      <span>{day.date.getDate()}</span>
                      {onDuty && (
                        <>
                          <span className="flex gap-0.5">
                            {codes.map(c => (
                              <CodeDot key={c} code={c} className="size-1.5" />
                            ))}
                          </span>
                          {/* La couleur seule ne suffit pas : le libellé du
                              créneau est lu par les lecteurs d'écran. */}
                          <span className="sr-only">{` — ${labels}`}</span>
                        </>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {present.length > 0 ? (
        <ul className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-slate-600 dark:text-slate-400">
          {present.map(code => (
            <li key={code} className="flex items-center gap-1.5">
              <CodeDot code={code} className="size-2" />
              {shiftLabel(code)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-center text-[11px] text-slate-500 dark:text-slate-400">
          {t('counters.calendarEmpty')}
        </p>
      )}
    </div>
  );
}
