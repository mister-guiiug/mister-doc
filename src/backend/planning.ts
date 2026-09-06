import { getSupabase, subscribeTable } from '../lib/supabase.ts';
import { monthBounds } from '../lib/dates.ts';
import type { MonthCopyRow } from '../lib/monthCopy.ts';
import type { ShiftType } from '../lib/shifts.ts';
import type { Shift } from './types.ts';

// Les gardes cliniques excluent « S3 » : ces heures non cliniques vivent
// désormais dans la table `hnc_hours` (cf. backend/hnc.ts). Le filtre neq garde
// les anciennes lignes S3 éventuelles hors des compteurs et de la grille.
/** Toutes les affectations (cliniques) d'un mois. */
export async function listMonthShifts(
  year: number,
  month: number
): Promise<Shift[]> {
  const [from, to] = monthBounds(year, month);
  const { data, error } = await getSupabase()
    .from('shifts')
    .select('*')
    .neq('shift_type', 'S3')
    .gte('work_date', from)
    .lte('work_date', to)
    .order('work_date');
  if (error) throw new Error(error.message);
  return (data ?? []) as Shift[];
}

/** Gardes cliniques sur une plage de dates (bornes ISO incluses). */
export async function listShiftsBetween(
  fromISO: string,
  toISO: string
): Promise<Shift[]> {
  const { data, error } = await getSupabase()
    .from('shifts')
    .select('*')
    .neq('shift_type', 'S3')
    .gte('work_date', fromISO)
    .lte('work_date', toISO);
  if (error) throw new Error(error.message);
  return (data ?? []) as Shift[];
}

/** Affecte (ou réaffecte) un médecin à un créneau donné (1 médecin/créneau/jour). */
export async function assignShift(
  workDate: string,
  shiftType: ShiftType,
  doctorId: string,
  createdBy: string | null
): Promise<Shift> {
  const { data, error } = await getSupabase()
    .from('shifts')
    .upsert(
      {
        work_date: workDate,
        shift_type: shiftType,
        doctor_id: doctorId,
        created_by: createdBy,
      },
      { onConflict: 'work_date,shift_type' }
    )
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Shift;
}

/**
 * Insère un lot de gardes en UNE transaction (copie de mois). La RPC ignore les
 * créneaux déjà attribués (`on conflict do nothing`) : rien n'est écrasé. Elle
 * reste en SECURITY INVOKER côté base — RLS, verrou de mois et historique
 * s'appliquent — et renvoie le nombre de lignes réellement créées.
 */
export async function assignShiftsBulk(
  rows: readonly MonthCopyRow[]
): Promise<number> {
  const { data, error } = await getSupabase().rpc('assign_shifts_bulk', {
    p_rows: rows,
  });
  if (error) throw new Error(error.message);
  return (data as number | null) ?? 0;
}

/**
 * Le résultat d'une écriture CONDITIONNELLE de créneau (migration 0027).
 * `applied = false` signifie que l'occupant a changé depuis le geste :
 * `holder*` dit qui l'occupe maintenant — la seule information qui permette de
 * le dire au médecin dont l'écriture est refusée.
 */
export interface ShiftWriteResult {
  applied: boolean;
  holderId: string | null;
  holderName: string | null;
}

function asShiftWriteResult(data: unknown): ShiftWriteResult {
  const row = (data ?? {}) as {
    applied?: boolean;
    holder_id?: string | null;
    holder_name?: string | null;
  };
  return {
    applied: row.applied === true,
    holderId: row.holder_id ?? null,
    holderName: row.holder_name ?? null,
  };
}

/**
 * Affecte un médecin SI le créneau est encore dans l'état qu'on avait sous les
 * yeux (`expectedDoctorId`, `null` = vu libre). Le chemin du REJEU d'une
 * écriture hors ligne : contrairement à `assignShift`, qui écrase en connaissance
 * de cause parce que l'utilisateur voit l'occupant à l'instant du clic, celui-ci
 * ne délogera jamais un collègue arrivé entre-temps. La comparaison et
 * l'écriture sont la même instruction SQL — c'est la base qui tranche.
 */
export async function assignShiftIfUnchanged(
  workDate: string,
  shiftType: ShiftType,
  doctorId: string,
  expectedDoctorId: string | null
): Promise<ShiftWriteResult> {
  const { data, error } = await getSupabase().rpc('assign_shift_if_unchanged', {
    p_work_date: workDate,
    p_shift_type: shiftType,
    p_doctor_id: doctorId,
    p_expected_doctor_id: expectedDoctorId,
  });
  if (error) throw new Error(error.message);
  return asShiftWriteResult(data);
}

/** Libère un créneau SI son occupant est encore celui qu'on croyait retirer. */
export async function clearShiftIfUnchanged(
  workDate: string,
  shiftType: ShiftType,
  expectedDoctorId: string
): Promise<ShiftWriteResult> {
  const { data, error } = await getSupabase().rpc('clear_shift_if_unchanged', {
    p_work_date: workDate,
    p_shift_type: shiftType,
    p_expected_doctor_id: expectedDoctorId,
  });
  if (error) throw new Error(error.message);
  return asShiftWriteResult(data);
}

/** Libère un créneau (supprime l'affectation). */
export async function clearShift(
  workDate: string,
  shiftType: ShiftType
): Promise<void> {
  const { error } = await getSupabase()
    .from('shifts')
    .delete()
    .eq('work_date', workDate)
    .eq('shift_type', shiftType);
  if (error) throw new Error(error.message);
}

/**
 * Abonnement Realtime aux changements de planning. Renvoie une fonction de
 * désabonnement. `onChange` est appelé à chaque INSERT/UPDATE/DELETE.
 */
export function subscribeShifts(onChange: () => void): () => void {
  return subscribeTable('shifts', onChange);
}
