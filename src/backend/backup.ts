import { getSupabase } from '../lib/supabase.ts';
import type { BackupMeta } from './types.ts';

/** Crée + renvoie un instantané complet (admin). */
export async function adminBackup(): Promise<unknown> {
  const { data, error } = await getSupabase().rpc('admin_backup');
  if (error) throw new Error(error.message);
  return data;
}

/** Restaure un instantané (admin). mode 'merge' (défaut) ou 'replace'. */
export async function adminRestore(
  payload: unknown,
  mode: 'merge' | 'replace'
): Promise<void> {
  const { error } = await getSupabase().rpc('admin_restore', {
    p_payload: payload,
    p_mode: mode,
  });
  if (error) throw new Error(error.message);
}

/** Métadonnées des sauvegardes stockées (sans le payload). */
export async function listBackups(): Promise<BackupMeta[]> {
  const { data, error } = await getSupabase()
    .from('backups')
    .select('id,kind,size,created_at')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as BackupMeta[];
}

/** Récupère le payload d'une sauvegarde stockée (pour téléchargement/restauration). */
export async function getBackupPayload(id: string): Promise<unknown> {
  const { data, error } = await getSupabase()
    .from('backups')
    .select('payload')
    .eq('id', id)
    .single();
  if (error) throw new Error(error.message);
  return (data as { payload: unknown }).payload;
}

export async function deleteBackup(id: string): Promise<void> {
  const { error } = await getSupabase().from('backups').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
