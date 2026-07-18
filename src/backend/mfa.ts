import { getSupabase } from '../lib/supabase.ts';
import { frAuthError } from '../lib/authErrors.ts';

/**
 * Enveloppe l'API MFA (double authentification) de Supabase Auth, facteur **TOTP**
 * uniquement (application type Google Authenticator / Authy) : disponible sur le
 * plan gratuit, sans SMS. Les facteurs sont stockés et vérifiés côté Supabase
 * (`auth.mfa_factors`) — AUCUNE table applicative n'est concernée.
 *
 * La 2FA est **opt-in** : un médecin l'active depuis son profil. Seuls les comptes
 * ayant un facteur TOTP *vérifié* sont ensuite soumis au défi au login (cf.
 * `getAssuranceLevel`/`mfaChallengeNeeded`), ce qui exclut tout verrouillage massif.
 */

export interface TotpEnrollment {
  factorId: string;
  /** QR code prêt à afficher (`data:image/svg+xml;…`, autorisé par la CSP `img-src data:`). */
  qrCode: string;
  /** Secret en clair, pour saisie manuelle si le QR n'est pas scannable. */
  secret: string;
}

/** Niveau d'assurance de la session : aal1 = mot de passe, aal2 = mot de passe + TOTP. */
export interface AssuranceLevel {
  current: string | null;
  next: string | null;
}

/** Vrai si la session doit encore franchir l'étape TOTP (facteur vérifié mais session aal1). */
export function mfaChallengeNeeded(a: AssuranceLevel): boolean {
  return a.current === 'aal1' && a.next === 'aal2';
}

/**
 * Niveau d'assurance courant/atteignable. Lecture **locale** de la session (le
 * claim `aal` du JWT + `session.user.factors`) : aucun appel réseau, donc sûr
 * hors-ligne (échec → l'appelant retombe sur « pas de défi »).
 */
export async function getAssuranceLevel(): Promise<AssuranceLevel> {
  const { data, error } =
    await getSupabase().auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw new Error(error.message);
  return { current: data.currentLevel, next: data.nextLevel };
}

/** Identifiant du 1er facteur TOTP **vérifié**, ou null (appel réseau : `getUser`). */
export async function verifiedTotpFactorId(): Promise<string | null> {
  const { data, error } = await getSupabase().auth.mfa.listFactors();
  if (error) throw new Error(frAuthError(error.message));
  return data.totp[0]?.id ?? null;
}

/**
 * Démarre un enrôlement TOTP : renvoie le QR code + le secret à confirmer. Les
 * éventuels facteurs TOTP **non vérifiés** d'un enrôlement précédent abandonné
 * sont d'abord nettoyés (évite l'accumulation et les conflits de nom).
 */
export async function enrollTotp(): Promise<TotpEnrollment> {
  const sb = getSupabase();
  const { data: list } = await sb.auth.mfa.listFactors();
  const stale = (list?.all ?? []).filter(
    f => f.factor_type === 'totp' && f.status !== 'verified'
  );
  await Promise.all(
    stale.map(f => sb.auth.mfa.unenroll({ factorId: f.id }))
  ).catch(() => {
    /* best-effort */
  });

  const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp' });
  if (error || !data) throw new Error(frAuthError(error?.message));
  return {
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
  };
}

/** Confirme l'enrôlement : vérifie le code TOTP saisi → facteur « vérifié », session aal2. */
export async function confirmTotpEnrollment(
  factorId: string,
  code: string
): Promise<void> {
  const { error } = await getSupabase().auth.mfa.challengeAndVerify({
    factorId,
    code: code.trim(),
  });
  if (error) throw new Error(frAuthError(error.message));
}

/** Annule un enrôlement en cours (retire le facteur non vérifié). Best-effort. */
export async function cancelTotpEnrollment(factorId: string): Promise<void> {
  try {
    await getSupabase().auth.mfa.unenroll({ factorId });
  } catch {
    /* le prochain enrôlement nettoiera de toute façon les facteurs orphelins */
  }
}

/** Désactive la 2FA : retire tous les facteurs TOTP du compte. */
export async function disableTotp(): Promise<void> {
  const sb = getSupabase();
  const { data: list, error } = await sb.auth.mfa.listFactors();
  if (error) throw new Error(frAuthError(error.message));
  const totp = (list.all ?? []).filter(f => f.factor_type === 'totp');
  for (const f of totp) {
    const { error: ue } = await sb.auth.mfa.unenroll({ factorId: f.id });
    if (ue) throw new Error(frAuthError(ue.message));
  }
}

/**
 * Défi TOTP au login : élève la session de aal1 à aal2 avec le code à 6 chiffres.
 * Émet `MFA_CHALLENGE_VERIFIED` en cas de succès (recalcul de l'assurance côté
 * `AuthContext`).
 */
export async function challengeTotp(code: string): Promise<void> {
  const factorId = await verifiedTotpFactorId();
  if (!factorId) throw new Error('Aucun facteur TOTP à vérifier.');
  const { error } = await getSupabase().auth.mfa.challengeAndVerify({
    factorId,
    code: code.trim(),
  });
  if (error) throw new Error(frAuthError(error.message));
}

/**
 * (Re)génère des codes de secours à usage unique et les renvoie EN CLAIR une seule
 * fois (à afficher/enregistrer). Invalide les anciens. Seul leur hash est stocké.
 */
export async function generateRecoveryCodes(): Promise<string[]> {
  const { data, error } = await getSupabase().rpc(
    'generate_mfa_recovery_codes'
  );
  if (error) throw new Error(frAuthError(error.message));
  return (data as string[] | null) ?? [];
}

/**
 * Récupération : consomme un code de secours et retire les facteurs TOTP. Renvoie
 * `true` si le code est accepté (l'accès n'exige alors plus l'étape à 6 chiffres).
 */
export async function redeemRecoveryCode(code: string): Promise<boolean> {
  const { data, error } = await getSupabase().rpc('use_mfa_recovery_code', {
    p_code: code,
  });
  if (error) throw new Error(frAuthError(error.message));
  return data === true;
}
