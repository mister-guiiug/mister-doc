import { fromISODate, toISODate } from './dates.ts';

/**
 * Détection des situations à risque dans le planning :
 *  - repos de sécurité : un médecin de garde le lendemain d'une garde de NUIT (S1N) ;
 *  - conflit : un médecin en garde ET en absence le même jour ;
 *  - cumul : un médecin sur plusieurs créneaux le même jour.
 */

export interface Issue {
  level: 'error' | 'warn';
  message: string;
}

export interface ShiftLike {
  work_date: string;
  shift_type: string;
  doctor_id: string;
}
export interface LeaveLike {
  work_date: string;
  doctor_id: string;
}

function prevISO(iso: string): string {
  const d = fromISODate(iso);
  d.setDate(d.getDate() - 1);
  return toISODate(d);
}

/** Issues par jour (clé ISO) sur un ensemble de gardes + absences. */
export function computeIssues(
  shifts: ShiftLike[],
  leaves: LeaveLike[],
  nameById: Map<string, string>
): Map<string, Issue[]> {
  const out = new Map<string, Issue[]>();
  const add = (iso: string, issue: Issue) => {
    const arr = out.get(iso);
    if (arr) arr.push(issue);
    else out.set(iso, [issue]);
  };
  const name = (id: string) => nameById.get(id) ?? '?';

  // Index gardes par jour et par (jour|médecin).
  const byDay = new Map<string, ShiftLike[]>();
  const nightByDoctorDate = new Set<string>(); // `${doctor}|${date}` a une S1N
  for (const s of shifts) {
    const arr = byDay.get(s.work_date);
    if (arr) arr.push(s);
    else byDay.set(s.work_date, [s]);
    if (s.shift_type === 'S1N') nightByDoctorDate.add(`${s.doctor_id}|${s.work_date}`);
  }
  const leaveByDoctorDate = new Set(leaves.map(l => `${l.doctor_id}|${l.work_date}`));

  // Repos de sécurité + cumul + conflit.
  for (const [iso, dayShifts] of byDay) {
    const perDoctor = new Map<string, number>();
    for (const s of dayShifts) {
      perDoctor.set(s.doctor_id, (perDoctor.get(s.doctor_id) ?? 0) + 1);
      // repos de sécurité : garde ce jour alors qu'il y avait une nuit la veille
      if (nightByDoctorDate.has(`${s.doctor_id}|${prevISO(iso)}`)) {
        add(iso, {
          level: 'error',
          message: `Repos de sécurité : ${name(s.doctor_id)} de garde au lendemain d'une nuit.`,
        });
      }
      // conflit garde + absence
      if (leaveByDoctorDate.has(`${s.doctor_id}|${iso}`)) {
        add(iso, {
          level: 'error',
          message: `${name(s.doctor_id)} est en garde ET en absence le même jour.`,
        });
      }
    }
    for (const [doctorId, n] of perDoctor) {
      if (n > 1)
        add(iso, {
          level: 'warn',
          message: `${name(doctorId)} est sur ${n} créneaux le même jour.`,
        });
    }
  }

  return out;
}

/** Médecins en absence un jour donné. */
export function doctorsOnLeave(iso: string, leaves: LeaveLike[]): Set<string> {
  return new Set(leaves.filter(l => l.work_date === iso).map(l => l.doctor_id));
}

/** Médecins déjà de garde un jour donné. */
export function doctorsWorking(iso: string, shifts: ShiftLike[]): Set<string> {
  return new Set(shifts.filter(s => s.work_date === iso).map(s => s.doctor_id));
}

/** Vrai si affecter ce médecin ce jour enfreint le repos (nuit la veille). */
export function violatesRest(
  doctorId: string,
  iso: string,
  shifts: ShiftLike[]
): boolean {
  const prev = prevISO(iso);
  return shifts.some(
    s => s.doctor_id === doctorId && s.work_date === prev && s.shift_type === 'S1N'
  );
}
