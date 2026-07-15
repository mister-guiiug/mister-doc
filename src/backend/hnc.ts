import { getSupabase, subscribeTable } from '../lib/supabase.ts';
import { toISODate } from '../lib/dates.ts';
import type { HncEntry } from './types.ts';

/**
 * Accès aux heures non cliniques (table `hnc_hours`). Modèle proche des congés :
 * une entrée par médecin et par jour, édition partagée entre médecins approuvés.
 */

function monthBounds(year: number, month: number): [string, string] {
  return [toISODate(new Date(year, month, 1)), toISODate(new Date(year, month + 1, 0))];
}

/** Toutes les entrées HNC d'un mois. */
export async function listMonthHnc(
  year: number,
  month: number
): Promise<HncEntry[]> {
  const [from, to] = monthBounds(year, month);
  const { data, error } = await getSupabase()
    .from('hnc_hours')
    .select('*')
    .gte('work_date', from)
    .lte('work_date', to)
    .order('work_date');
  if (error) throw new Error(error.message);
  return (data ?? []) as HncEntry[];
}

/** Entrées HNC sur une plage de dates (bornes ISO incluses). */
export async function listHncBetween(
  fromISO: string,
  toISO: string
): Promise<HncEntry[]> {
  const { data, error } = await getSupabase()
    .from('hnc_hours')
    .select('*')
    .gte('work_date', fromISO)
    .lte('work_date', toISO);
  if (error) throw new Error(error.message);
  return (data ?? []) as HncEntry[];
}

/** Déclare (ou met à jour) les heures non cliniques d'un médecin un jour donné. */
export async function setHnc(
  doctorId: string,
  workDate: string,
  hours: number,
  createdBy: string | null
): Promise<HncEntry> {
  const { data, error } = await getSupabase()
    .from('hnc_hours')
    .upsert(
      {
        doctor_id: doctorId,
        work_date: workDate,
        hours,
        created_by: createdBy,
      },
      { onConflict: 'doctor_id,work_date' }
    )
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as HncEntry;
}

/** Supprime une entrée HNC. */
export async function clearHnc(id: string): Promise<void> {
  const { error } = await getSupabase().from('hnc_hours').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export function subscribeHnc(onChange: () => void): () => void {
  return subscribeTable('hnc_hours', onChange);
}
