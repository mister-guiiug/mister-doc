import { getSupabase, subscribeTable } from '../lib/supabase.ts';
import { monthBounds } from '../lib/dates.ts';
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
