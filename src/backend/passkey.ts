import { getSupabase } from '../lib/supabase.ts';
import { frAuthError } from '../lib/authErrors.ts';

/**
 * Passkeys / WebAuthn (connexion par **empreinte**, Face ID, Windows Hello, clé de
 * sécurité). S'appuie sur les passkeys natives de Supabase Auth (API en beta,
 * activée via `experimental.passkey` dans le client). Le compte reste utilisable
 * au mot de passe : la passkey est un moyen de connexion **additionnel** et
 * **opt-in** (le médecin l'enregistre depuis son profil, sur un appareil doté d'un
 * capteur biométrique). Aucune clé privée ne quitte l'appareil ; le serveur ne
 * stocke que la clé publique et des métadonnées.
 */

/** Métadonnées d'une passkey enregistrée (jamais la clé privée). */
export interface Passkey {
  id: string;
  /** Nom lisible (peut être absent si l'authentificateur n'en fournit pas). */
  friendlyName?: string;
  createdAt: string;
  lastUsedAt?: string;
}

/** Le navigateur expose-t-il WebAuthn ? Sinon : masquer toute l'UI passkey. */
export function passkeysSupported(): boolean {
  return typeof window !== 'undefined' && !!window.PublicKeyCredential;
}

/**
 * Un authentificateur de PLATEFORME (empreinte / Face ID / Windows Hello) est-il
 * disponible sur cet appareil ? Best-effort — sert à adapter le discours. Ne
 * conditionne pas l'affichage : une clé de sécurité externe reste valable.
 */
export async function platformAuthenticatorAvailable(): Promise<boolean> {
  try {
    return (
      passkeysSupported() &&
      (await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
    );
  } catch {
    return false;
  }
}

/** Traduit les erreurs WebAuthn (annulation, doublon, contexte non sûr) en FR. */
function frPasskeyError(e: unknown): string {
  const name = (e as { name?: string })?.name ?? '';
  const msg =
    e instanceof Error
      ? e.message
      : ((e as { message?: string })?.message ?? '');
  const hay = `${name} ${msg}`;
  if (/NotAllowed|AbortError|abort|cancel|timed? ?out|timeout/i.test(hay)) {
    return 'Opération annulée.';
  }
  if (/InvalidState|already|exists|déjà/i.test(hay)) {
    return 'Une passkey est déjà enregistrée pour ce compte sur cet appareil.';
  }
  if (/SecurityError|insecure|https/i.test(hay)) {
    return 'Contexte non sécurisé : la connexion par empreinte exige HTTPS.';
  }
  if (/no (available )?(credential|passkey)|not found|aucun/i.test(hay)) {
    return "Aucune passkey n'a été trouvée sur cet appareil.";
  }
  return frAuthError(msg || null);
}

/**
 * Connexion passwordless par passkey. Déroule toute la cérémonie WebAuthn puis
 * établit la session — l'écouteur `onAuthStateChange` d'`AuthContext` prend alors
 * le relais (hydratation, éventuel défi TOTP). Lève une erreur FR sinon.
 */
export async function signInWithPasskey(): Promise<void> {
  try {
    const { error } = await getSupabase().auth.signInWithPasskey();
    if (error) throw error;
  } catch (e) {
    throw new Error(frPasskeyError(e));
  }
}

/** Enregistre une nouvelle passkey pour le compte connecté (exige une session). */
export async function registerPasskey(): Promise<void> {
  try {
    const { error } = await getSupabase().auth.registerPasskey();
    if (error) throw error;
  } catch (e) {
    throw new Error(frPasskeyError(e));
  }
}

/** Liste les passkeys enregistrées pour le compte connecté. */
export async function listPasskeys(): Promise<Passkey[]> {
  const { data, error } = await getSupabase().auth.passkey.list();
  if (error) throw new Error(frPasskeyError(error));
  return (data ?? []).map(p => ({
    id: p.id,
    friendlyName: p.friendly_name,
    createdAt: p.created_at,
    lastUsedAt: p.last_used_at,
  }));
}

/** Retire une passkey : l'appareil correspondant ne pourra plus s'en servir. */
export async function deletePasskey(passkeyId: string): Promise<void> {
  const { error } = await getSupabase().auth.passkey.delete({ passkeyId });
  if (error) throw new Error(frPasskeyError(error));
}
