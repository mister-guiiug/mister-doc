import { getSupabase } from '../lib/supabase.ts';
import type { Doctor } from './types.ts';

/**
 * Accès aux médecins. Les écritures sensibles passent par des fonctions RPC
 * SECURITY DEFINER côté Postgres (cf. migration) : le client n'écrit jamais
 * directement dans la table `doctors`.
 */

/** Upsert de la fiche du médecin connecté (à chaque login). */
export async function ensureSelfDoctor(name?: string): Promise<Doctor> {
  const { data, error } = await getSupabase().rpc('ensure_self_doctor', {
    p_name: name ?? null,
  });
  if (error) throw new Error(error.message);
  return data as Doctor;
}

export async function updateMyProfile(
  name: string,
  color: string
): Promise<Doctor> {
  const { data, error } = await getSupabase().rpc('update_my_profile', {
    p_name: name,
    p_color: color,
  });
  if (error) throw new Error(error.message);
  return data as Doctor;
}

/**
 * Supprime la demande d'accès du compte connecté (compte « en attente »
 * uniquement) : retire la fiche médecin et l'utilisateur d'authentification.
 */
export async function deleteMyAccount(): Promise<void> {
  const { error } = await getSupabase().rpc('delete_my_account');
  if (error) throw new Error(error.message);
}

/** Devenir le premier admin via le code de bootstrap. */
export async function claimAdmin(code: string): Promise<Doctor> {
  const { data, error } = await getSupabase().rpc('claim_admin', {
    p_code: code,
  });
  if (error) throw new Error(error.message);
  return data as Doctor;
}

/** Roster complet (visible par les médecins approuvés). */
export async function listDoctors(): Promise<Doctor[]> {
  const { data, error } = await getSupabase()
    .from('doctors')
    .select('*')
    .order('name');
  if (error) throw new Error(error.message);
  return (data ?? []) as Doctor[];
}

export async function adminSetDoctor(
  id: string,
  approved: boolean | null,
  isAdmin: boolean | null
): Promise<Doctor> {
  const { data, error } = await getSupabase().rpc('admin_set_doctor', {
    p_id: id,
    p_approved: approved,
    p_is_admin: isAdmin,
  });
  if (error) throw new Error(error.message);
  return data as Doctor;
}

/** Admin : renommer / recolorer n'importe quel médecin (compte ou roster). */
export async function adminUpdateDoctor(
  id: string,
  name: string,
  color: string
): Promise<Doctor> {
  const { data, error } = await getSupabase().rpc('admin_update_doctor', {
    p_id: id,
    p_name: name,
    p_color: color,
  });
  if (error) throw new Error(error.message);
  return data as Doctor;
}

export async function adminAddRoster(
  name: string,
  color = '#2563eb'
): Promise<Doctor> {
  const { data, error } = await getSupabase().rpc('admin_add_roster', {
    p_name: name,
    p_color: color,
  });
  if (error) throw new Error(error.message);
  return data as Doctor;
}

export async function adminDeleteDoctor(id: string): Promise<void> {
  const { error } = await getSupabase().rpc('admin_delete_doctor', {
    p_id: id,
  });
  if (error) throw new Error(error.message);
}

/** Admin : rejeter une demande en attente (supprime la fiche + le compte auth). */
export async function adminRejectDoctor(id: string): Promise<void> {
  const { error } = await getSupabase().rpc('admin_reject_doctor', {
    p_id: id,
  });
  if (error) throw new Error(error.message);
}
