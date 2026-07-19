import { getSupabase } from '../lib/supabase.ts';
import type { ShiftTypeDef } from '../lib/shifts.ts';

/**
 * Accès à la table `shift_types` (types de créneaux configurables). Lecture pour
 * tous les approuvés ; écritures réservées aux admins via RPC SECURITY DEFINER.
 */

interface ShiftTypeRow {
  code: string;
  label: string;
  hours: number | string;
  sort_order: number;
  clinical: boolean;
  is_night: boolean;
  weekend: boolean;
  start_time: string | null;
  end_time: string | null;
  end_day_offset: number;
  color: string | null;
  active: boolean;
}

/** Normalise « 08:00:00 » → « 08:00 » (format des <input type="time">). */
function hhmm(t: string | null): string | null {
  return t ? t.slice(0, 5) : null;
}

function toDef(r: ShiftTypeRow): ShiftTypeDef {
  return {
    code: r.code,
    label: r.label,
    hours: Number(r.hours),
    clinical: r.clinical,
    isNight: r.is_night,
    weekend: r.weekend,
    sortOrder: r.sort_order,
    startTime: hhmm(r.start_time),
    endTime: hhmm(r.end_time),
    endDayOffset: r.end_day_offset,
    color: r.color,
    active: r.active,
  };
}

/** Liste des types de créneaux, triés par ordre d'affichage. */
export async function listShiftTypes(): Promise<ShiftTypeDef[]> {
  const { data, error } = await getSupabase()
    .from('shift_types')
    .select(
      'code,label,hours,sort_order,clinical,is_night,weekend,start_time,end_time,end_day_offset,color,active'
    )
    .order('sort_order', { ascending: true });
  if (error) throw new Error(error.message);
  return (data as ShiftTypeRow[]).map(toDef);
}

/** Créer / mettre à jour un type (admin). */
export async function adminUpsertShiftType(def: ShiftTypeDef): Promise<void> {
  const { error } = await getSupabase().rpc('admin_upsert_shift_type', {
    p_code: def.code,
    p_label: def.label,
    p_hours: def.hours,
    p_clinical: def.clinical,
    p_is_night: def.isNight,
    p_weekend: def.weekend,
    p_start_time: def.startTime,
    p_end_time: def.endTime,
    p_end_day_offset: def.endDayOffset,
    p_color: def.color,
    p_active: def.active,
  });
  if (error) throw new Error(error.message);
}

/** Activer / désactiver un type (admin). */
export async function adminSetShiftTypeActive(
  code: string,
  active: boolean
): Promise<void> {
  const { error } = await getSupabase().rpc('admin_set_shift_type_active', {
    p_code: code,
    p_active: active,
  });
  if (error) throw new Error(error.message);
}

/** Réordonner les types selon la liste de codes fournie (admin). */
export async function adminReorderShiftTypes(codes: string[]): Promise<void> {
  const { error } = await getSupabase().rpc('admin_reorder_shift_types', {
    p_codes: codes,
  });
  if (error) throw new Error(error.message);
}

/** Supprimer un type inutilisé (admin) ; échoue s'il est référencé. */
export async function adminDeleteShiftType(code: string): Promise<void> {
  const { error } = await getSupabase().rpc('admin_delete_shift_type', {
    p_code: code,
  });
  if (error) throw new Error(error.message);
}
