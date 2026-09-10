import type { Session } from '@supabase/supabase-js';

/**
 * LA SESSION TELLE QU'ELLE EST ÉCRITE SUR L'APPAREIL, lue sans passer par
 * Supabase.
 *
 * POURQUOI NE PAS SIMPLEMENT APPELER `auth.getSession()`. Parce que cet appel
 * n'est pas une lecture : si le jeton d'accès est périmé — et il ne vit qu'une
 * heure — il RENOUVELLE le jeton contre le réseau, avec des reprises à
 * intervalle croissant. Sans réseau, aucune ne peut aboutir : mesuré sur la
 * production, l'application restait 27 secondes sur « Chargement… » avant que
 * Supabase renonce et annonce « pas de session » — et la porte d'accès
 * affichait alors l'écran de CONNEXION, qu'on ne peut pas franchir hors ligne.
 * Une application dont le planning, la fiche médecin et la file d'écritures
 * sont pourtant tous en cache sur l'appareil.
 *
 * Le nom de la case est celui que `@supabase/supabase-js` construit depuis
 * l'URL du projet (`sb-<ref>-auth-token`). On ne le recalcule pas : on le
 * RECONNAÎT dans le stockage. Reproduire la formule, ce serait s'engager à la
 * suivre à chaque version de la bibliothèque, pour un gain nul — et écrire
 * `storageKey` à la main déconnecterait d'un coup tous ceux dont la session
 * est rangée sous l'ancien nom.
 */
const NOM_DE_CASE = /^sb-[a-z0-9]+-auth-token$/;

/**
 * Ce que Supabase considère comme une session récupérable : les trois champs
 * que son propre `_isValidSession` exige, plus l'identifiant d'utilisateur
 * sans lequel l'application ne saurait pas quelle fiche médecin lire en cache.
 */
function estUneSession(valeur: unknown): valeur is Session {
  if (typeof valeur !== 'object' || valeur === null) return false;
  const s = valeur as Record<string, unknown>;
  return (
    typeof s.access_token === 'string' &&
    typeof s.refresh_token === 'string' &&
    typeof s.expires_at === 'number' &&
    typeof s.user === 'object' &&
    s.user !== null &&
    typeof (s.user as Record<string, unknown>).id === 'string'
  );
}

/**
 * La session rangée sur cet appareil, ou `null`. **Best-effort** : navigation
 * privée, stockage refusé, contenu illisible — tout échoue en silence et rend
 * `null`, exactement comme une absence de session.
 *
 * PÉRIMÉE OU NON, ELLE EST RENDUE. C'est délibéré : hors ligne, un jeton
 * d'accès expiré ne dit rien de l'utilisateur — il dit seulement qu'une heure
 * a passé. Le renouvellement se fera au retour du réseau, et `onAuthStateChange`
 * corrigera l'état ; si le jeton de rafraîchissement a été révoqué entretemps,
 * Supabase émettra `SIGNED_OUT` et la porte se refermera d'elle-même.
 */
export function storedSession(): Session | null {
  try {
    const stockage = globalThis.localStorage;
    if (!stockage) return null;
    for (let i = 0; i < stockage.length; i++) {
      const nom = stockage.key(i);
      if (!nom || !NOM_DE_CASE.test(nom)) continue;
      const brut = stockage.getItem(nom);
      if (!brut) continue;
      const valeur: unknown = JSON.parse(brut);
      if (estUneSession(valeur)) return valeur;
    }
    return null;
  } catch {
    return null;
  }
}
