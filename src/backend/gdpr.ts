import { getSupabase } from '../lib/supabase.ts';
import type { Doctor } from './types.ts';

/**
 * Export RGPD (droit d'accès / portabilité, art. 15 & 20) : rassemble les données
 * personnelles du médecin connecté à partir des lectures autorisées par la RLS
 * (aucune RPC dédiée). Couvre l'identité et toutes ses données de planning.
 */
export async function exportMyData(
  doctor: Doctor
): Promise<Record<string, unknown>> {
  const sb = getSupabase();
  const id = doctor.id;

  const [shifts, leaves, hnc, wishes, notes, swaps, notifs] = await Promise.all([
    sb
      .from('shifts')
      .select('work_date,shift_type,created_at')
      .eq('doctor_id', id)
      .order('work_date'),
    sb
      .from('leaves')
      .select('work_date,kind,hours,created_at')
      .eq('doctor_id', id)
      .order('work_date'),
    sb
      .from('hnc_hours')
      .select('work_date,hours,created_at')
      .eq('doctor_id', id)
      .order('work_date'),
    sb
      .from('wishes')
      .select('work_date,kind,note,created_at')
      .eq('doctor_id', id)
      .order('work_date'),
    sb
      .from('day_notes')
      .select('work_date,note,updated_at')
      .eq('created_by', id)
      .order('work_date'),
    sb
      .from('swap_requests')
      .select('work_date,shift_type,from_doctor,to_doctor,status,message,created_at')
      .or(`from_doctor.eq.${id},to_doctor.eq.${id}`)
      .order('created_at'),
    sb
      .from('notifications')
      .select('type,title,body,work_date,read,created_at')
      .eq('doctor_id', id)
      .order('created_at'),
  ]);

  for (const r of [shifts, leaves, hnc, wishes, notes, swaps, notifs]) {
    if (r.error) throw new Error(r.error.message);
  }

  return {
    _meta: {
      export: 'mister-doc — données personnelles (RGPD, art. 15/20)',
      genere_le: new Date().toISOString(),
    },
    profil: {
      id: doctor.id,
      nom: doctor.name,
      email: doctor.email,
      couleur: doctor.color,
      administrateur: doctor.is_admin,
      approuve: doctor.approved,
      cree_le: doctor.created_at,
    },
    gardes: shifts.data ?? [],
    absences: leaves.data ?? [],
    heures_non_cliniques: hnc.data ?? [],
    voeux: wishes.data ?? [],
    notes_redigees: notes.data ?? [],
    echanges: swaps.data ?? [],
    notifications: notifs.data ?? [],
  };
}

/** Télécharge l'export sous forme de fichier JSON lisible. */
export function downloadMyData(data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'mes-donnees-mister-doc.json';
  a.click();
  URL.revokeObjectURL(url);
}
