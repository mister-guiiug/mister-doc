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

/**
 * Effacement RGPD (art. 17) d'un compte APPROUVÉ par anonymisation : efface
 * l'identité (nom, e-mail, compte d'auth, tokens) et les données personnelles
 * (vœux, notifications, push) ; les gardes passées restent au planning sous une
 * identité anonymisée. Appelable par le médecin lui-même ou par un admin.
 */
export async function anonymizeDoctor(id: string): Promise<void> {
  const { error } = await getSupabase().rpc('anonymize_doctor', { p_id: id });
  if (error) throw new Error(error.message);
}

/**
 * Réinitialise la double authentification d'un médecin (admin) : supprime ses
 * facteurs TOTP. Récupération après perte de l'authentificateur — le médecin se
 * reconnecte ensuite avec son seul mot de passe.
 */
export async function adminResetMfa(id: string): Promise<void> {
  const { error } = await getSupabase().rpc('admin_reset_mfa', { p_id: id });
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
    // Colonnes EXPLICITES : jamais `calendar_token` (lien d'abonnement secret).
    // La migration 0015 en interdit la lecture aux clients au niveau des privilèges ;
    // un `select('*')` échouerait donc (permission refusée sur la colonne).
    .select('id,auth_id,name,email,color,is_admin,approved,created_at')
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
