import { getSupabase } from '../lib/supabase.ts';

/** Clés d'un abonnement Web Push (issues de `PushSubscription.toJSON()`). */
export interface PushKeys {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Enregistre (ou met à jour) l'abonnement push du médecin pour ce navigateur. */
export async function savePushSubscription(
  doctorId: string,
  k: PushKeys
): Promise<void> {
  const { error } = await getSupabase()
    .from('push_subscriptions')
    .upsert(
      {
        endpoint: k.endpoint,
        doctor_id: doctorId,
        p256dh: k.p256dh,
        auth: k.auth,
      },
      { onConflict: 'endpoint' }
    );
  if (error) throw new Error(error.message);
}

/** Retire l'abonnement push (par endpoint). */
export async function deletePushSubscription(endpoint: string): Promise<void> {
  const { error } = await getSupabase()
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint);
  if (error) throw new Error(error.message);
}
