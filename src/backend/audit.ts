import { getSupabase } from '../lib/supabase.ts';
import type { AuditEntry } from './types.ts';

/**
 * Journal d'audit (réservé aux admins par la RLS), entrées les plus récentes
 * d'abord. Tri par `id` (identité monotone) = ordre d'insertion, sans index dédié.
 */
export async function listAuditLog(limit = 50): Promise<AuditEntry[]> {
  const { data, error } = await getSupabase()
    .from('audit_log')
    .select('*')
    .order('id', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as AuditEntry[];
}
