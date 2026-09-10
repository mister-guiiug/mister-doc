import type { Session } from '@supabase/supabase-js';
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
 * Niveau d'assurance courant/atteignable, DEMANDÉ À SUPABASE.
 *
 * Le commentaire disait ici « aucun appel réseau, donc sûr hors-ligne ». C'est
 * faux, et ça a coûté cher : `getAuthenticatorAssuranceLevel()` commence par
 * `auth.getSession()`, lequel RENOUVELLE le jeton quand il est périmé. Sans
 * réseau, cet appel tourne une demi-minute avant de renoncer. La lecture
 * réellement locale est `assuranceLevelFromSession`, juste en dessous.
 */
export async function getAssuranceLevel(): Promise<AssuranceLevel> {
  const { data, error } =
    await getSupabase().auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw new Error(error.message);
  return { current: data.currentLevel, next: data.nextLevel };
}

/**
 * LE MÊME NIVEAU, CALCULÉ SUR PLACE À PARTIR D'UNE SESSION DÉJÀ EN MAIN.
 *
 * Reproduit à l'identique la règle de `@supabase/auth-js` : le niveau COURANT
 * est le claim `aal` du jeton d'accès ; le niveau ATTEIGNABLE vaut `aal2` dès
 * qu'un facteur vérifié existe sur l'utilisateur de la session. La seule chose
 * que la bibliothèque fait en plus est d'aller CHERCHER cette session — c'est
 * précisément l'appel qu'on veut éviter au démarrage hors ligne.
 *
 * LE DÉFI TOTP N'EST DONC PAS CONTOURNÉ QUAND LE RÉSEAU MANQUE. Une session
 * restée en `aal1` avec un facteur vérifié rend toujours « défi requis », et la
 * porte se referme comme en ligne. C'est ce qui distingue ce calcul d'un
 * `setMfaRequired(false)` de confort.
 *
 * Le jeton n'est pas VÉRIFIÉ ici — sa signature ne se contrôle que côté
 * serveur. On ne lui fait pas confiance pour autant : c'est le serveur qui
 * refuse les écritures d'une session `aal1`, et hors ligne il n'y a de toute
 * façon rien à écrire.
 */
export function assuranceLevelFromSession(session: Session): AssuranceLevel {
  const current = claimAal(session.access_token);
  const verifie = session.user?.factors?.some(f => f.status === 'verified');
  return { current, next: verifie ? 'aal2' : current };
}

/** Le claim `aal` du jeton, ou null si le jeton n'est pas lisible. */
function claimAal(accessToken: string): string | null {
  try {
    const charge = accessToken.split('.')[1];
    if (!charge) return null;
    const json = atob(charge.replace(/-/g, '+').replace(/_/g, '/'));
    const payload: unknown = JSON.parse(json);
    const aal = (payload as Record<string, unknown> | null)?.aal;
    return typeof aal === 'string' ? aal : null;
  } catch {
    return null;
  }
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
