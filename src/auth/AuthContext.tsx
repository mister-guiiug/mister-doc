import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabase, subscribeTable } from '../lib/supabase.ts';
import { ensureSelfDoctor } from '../backend/doctors.ts';
import { getSettings } from '../backend/settings.ts';
import { listShiftTypes } from '../backend/shiftTypes.ts';
import { setShiftTypes } from '../lib/shifts.ts';
import {
  assuranceLevelFromSession,
  challengeTotp,
  getAssuranceLevel,
  mfaChallengeNeeded,
  redeemRecoveryCode,
} from '../backend/mfa.ts';
import { signInWithPasskey as passkeySignIn } from '../backend/passkey.ts';
import { setIncludePentecote } from '../lib/dates.ts';
import { frAuthError } from '../lib/authErrors.ts';
import { idbGet, idbSet } from '../lib/idbCache.ts';
import {
  navigateurHorsLigne,
  storedSupabaseSession,
} from '@mister-guiiug/dev-pwa-config/auth/stored-session';
import {
  clearAll,
  resetSyncQueue,
  unsentPlanningOps,
} from '../backend/syncQueue.ts';
import { useConfirm } from '../components/ui/confirmContext.ts';
import { useI18n } from '../i18n/index.ts';
import type { Doctor } from '../backend/types.ts';
import { AuthContext } from './useAuth.ts';

/**
 * Charge les réglages (jours fériés) et la configuration des types de créneaux
 * (`shift_types`) au login. Best-effort et indépendants : sur base incomplète ou
 * hors-ligne, chacun conserve ses défauts.
 */
async function applySettings(approved: boolean) {
  if (!approved) return;
  try {
    const s = await getSettings();
    setIncludePentecote(s.pentecote_ferie !== false);
  } catch {
    /* défauts conservés */
  }
  try {
    setShiftTypes(await listShiftTypes());
  } catch {
    /* défauts conservés */
  }
}

/**
 * COMBIEN DE TEMPS ON ACCEPTE D'ATTENDRE SUPABASE AU DÉMARRAGE.
 *
 * `auth.getSession()` n'est pas une lecture : jeton d'accès périmé, il part le
 * renouveler, avec des reprises à intervalle croissant bornées par sa propre
 * fenêtre de rafraîchissement — une trentaine de secondes. Derrière un portail
 * captif ou un Wi-Fi d'hôpital qui s'associe sans router, c'est autant de
 * sablier avant l'écran de connexion.
 *
 * Passé ce délai, on démarre sur la session écrite sur l'appareil et on laisse
 * `onAuthStateChange` corriger : un renouvellement réussi rendra
 * `TOKEN_REFRESHED`, un jeton révoqué rendra `SIGNED_OUT`. Aucun des deux ne
 * demande qu'on attende ici.
 */
const ATTENTE_MAX_MS = 5_000;

/** Marqueur d'attente dépassée, distinct de `null` (« pas de session »). */
const TROP_LONG = Symbol('attente dépassée');

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewMember, setPreviewMember] = useState(false);
  // La session est authentifiée (mot de passe) mais un facteur TOTP vérifié
  // exige encore l'étape à 6 chiffres avant d'accéder à l'application (aal1→aal2).
  const [mfaRequired, setMfaRequired] = useState(false);
  // Incrémenté quand la config des créneaux change (Realtime) → re-render global
  // pour refléter libellés/heures/colonnes sans recharger la page.
  const [, bumpConfig] = useState(0);
  // Pour la déconnexion : elle jette la file d'écritures hors ligne, et doit le
  // demander avant. `ConfirmProvider` et `I18nProvider` enveloppent ce provider.
  const confirm = useConfirm();
  const { t } = useI18n();

  const refreshDoctor = useCallback(async () => {
    const sb = getSupabase();
    const { data } = await sb.auth.getSession();
    if (!data.session) {
      setDoctor(null);
      return;
    }
    const key = `self-doctor:${data.session.user.id}`;
    try {
      const name =
        (data.session.user.user_metadata?.full_name as string | undefined) ??
        undefined;
      const d = await ensureSelfDoctor(name);
      setDoctor(d);
      void idbSet(key, d);
    } catch {
      setDoctor((await idbGet<Doctor>(key)) ?? null);
    }
  }, []);

  useEffect(() => {
    const sb = getSupabase();

    /**
     * @param depuisLeCache Démarrage sans réseau : on ne DEMANDE rien à
     * Supabase, on lit ce qui est déjà sur l'appareil. Les `catch` ci-dessous
     * savaient déjà retomber sur le cache — mais ils n'y arrivaient qu'APRÈS
     * l'échec, et chaque échec coûte la demi-minute de renouvellement du jeton.
     * Deux appels, une minute de sablier, pour finir sur des données qu'on
     * avait dès la première milliseconde.
     */
    async function hydrate(s: Session | null, depuisLeCache = false) {
      setSession(s);
      if (s) {
        const key = `self-doctor:${s.user.id}`;

        if (depuisLeCache) {
          // L'assurance se calcule sur place — le défi TOTP reste donc EXIGÉ
          // hors ligne si la session est en `aal1` avec un facteur vérifié.
          setMfaRequired(mfaChallengeNeeded(assuranceLevelFromSession(s)));
          setDoctor((await idbGet<Doctor>(key)) ?? null);
          setLoading(false);
          return;
        }

        // Défi TOTP éventuel. Best-effort → un échec ne bloque pas la porte.
        try {
          setMfaRequired(mfaChallengeNeeded(await getAssuranceLevel()));
        } catch {
          setMfaRequired(false);
        }
        try {
          const name =
            (s.user.user_metadata?.full_name as string | undefined) ??
            undefined;
          const d = await ensureSelfDoctor(name);
          setDoctor(d);
          void idbSet(key, d);
          await applySettings(d.approved);
        } catch {
          // Réseau tombé en cours de route : replier sur le médecin en cache
          // pour rester utilisable (consultation du planning mis en cache).
          setDoctor((await idbGet<Doctor>(key)) ?? null);
        }
      } else {
        setMfaRequired(false);
        setDoctor(null);
      }
      setLoading(false);
    }

    /**
     * L'AMORÇAGE NE DOIT JAMAIS DÉPENDRE DU RÉSEAU.
     *
     * Avant, il en dépendait entièrement : `getSession()` était appelé sans
     * condition, et hors ligne avec un jeton périmé — c'est-à-dire dès qu'une
     * heure a passé — il tournait 27 secondes avant de renoncer et d'annoncer
     * « pas de session ». La porte affichait alors l'écran de CONNEXION, qu'on
     * ne peut pas franchir sans réseau : le médecin de garde, au sous-sol, se
     * retrouvait dehors de son propre planning, pourtant en cache sur son
     * téléphone.
     *
     * Le repli ne dégrade rien quand le réseau est là : `hydrate` est le même,
     * et les rappels d'état de Supabase corrigent la session dès qu'elle est
     * renouvelée ou révoquée.
     */
    let vivant = true;
    let minuteur: ReturnType<typeof setTimeout> | undefined;

    async function amorcer() {
      const stockee = storedSupabaseSession() as Session | null;

      // Hors ligne : ne rien demander à Supabase. Il n'a que le réseau pour
      // répondre, et il mettra une demi-minute à l'admettre.
      //
      // `navigateurHorsLigne()` teste `onLine === false`, jamais `!onLine` :
      // hors navigateur la propriété n'existe pas, et `!undefined` ferait
      // croire à une coupure permanente.
      if (navigateurHorsLigne() && stockee) {
        await hydrate(stockee, true);
        return;
      }

      // En ligne — ou ce que le navigateur appelle ainsi. `navigator.onLine`
      // ne dit que « une interface est active » : il est vrai derrière un
      // portail captif comme sur un Wi-Fi qui ne route rien. D'où le délai.
      const issue = await Promise.race([
        sb.auth.getSession().then(({ data }) => data.session),
        new Promise<typeof TROP_LONG>(resoudre => {
          minuteur = setTimeout(() => resoudre(TROP_LONG), ATTENTE_MAX_MS);
        }),
      ]);
      clearTimeout(minuteur);
      if (!vivant) return;
      await hydrate(issue === TROP_LONG ? stockee : issue, issue === TROP_LONG);
    }

    void amorcer();
    const { data: sub } = sb.auth.onAuthStateChange((_event, s) => {
      void hydrate(s);
    });
    return () => {
      vivant = false;
      clearTimeout(minuteur);
      sub.subscription.unsubscribe();
    };
  }, []);

  // Rafraîchit la config des créneaux quand un admin la modifie (Realtime).
  const approved = !!doctor?.approved;
  useEffect(() => {
    if (!approved) return;
    return subscribeTable('shift_types', () => {
      listShiftTypes()
        .then(t => {
          setShiftTypes(t);
          bumpConfig(v => v + 1);
        })
        .catch(() => {});
    });
  }, [approved]);

  async function signIn(email: string, password: string) {
    const { error } = await getSupabase().auth.signInWithPassword({
      email,
      password,
    });
    return { error: error ? frAuthError(error.message) : undefined };
  }

  async function signUp(email: string, password: string, name: string) {
    const { error } = await getSupabase().auth.signUp({
      email,
      password,
      options: { data: { full_name: name.trim() } },
    });
    return { error: error ? frAuthError(error.message) : undefined };
  }

  async function signInWithLink(email: string) {
    const { error } = await getSupabase().auth.signInWithOtp({
      email,
      options: {
        // Le retour du lien est calculé depuis l'origine SERVIE, jamais depuis
        // une constante : le même bundle tourne en local et sur Pages. Cette
        // adresse doit figurer dans la liste d'URL autorisées du projet
        // Supabase (Authentication → URL Configuration), qui ne contient que
        // localhost:3000 à la création — sinon le lien part et n'arrive nulle
        // part. `flowType: 'pkce'` (lib/supabase.ts) renvoie `?code=`, que le
        // HashRouter ne touche pas ; un jeton dans le fragment serait perdu.
        emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,
        // Un compte se crée avec un nom, par `signUp`, et attend l'approbation
        // d'un administrateur : un lien vers une adresse inconnue ne doit pas
        // fabriquer un médecin sans nom.
        shouldCreateUser: false,
      },
    });
    if (!error) return {};
    // Le message que Supabase rend quand l'adresse n'a pas de compte et que
    // le lien ne peut pas en créer : le dire en clair, avec la sortie.
    if (/signups? not allowed/i.test(error.message)) {
      return {
        error:
          'Aucun compte pour cette adresse. Créez-en un (« Créer un compte »), ou vérifiez l’orthographe.',
      };
    }
    return { error: frAuthError(error.message) };
  }

  /**
   * LA FILE D'ÉCRITURES HORS LIGNE NE SURVIT PAS À LA DÉCONNEXION. Elle vit
   * dans le `localStorage` de l'APPAREIL, pas dans la session : sur le poste
   * partagé d'une salle de garde, les écritures laissées par le médecin qui
   * part repartiraient sous la session du suivant — au nom du suivant dans le
   * journal d'audit, et sous SES droits RLS.
   *
   * Les jeter est donc obligatoire, mais jamais en silence : ce sont des gestes
   * que le médecin croit enregistrés. On les compte et on demande.
   */
  async function signOut() {
    const enAttente = unsentPlanningOps();
    if (
      enAttente > 0 &&
      !(await confirm({
        message: t('sync.signOutPending', { n: enAttente }),
        danger: true,
        confirmLabel: t('sync.signOutAnyway'),
      }))
    )
      return;
    clearAll();
    resetSyncQueue();
    setPreviewMember(false);
    await getSupabase().auth.signOut();
  }

  /**
   * Connexion par passkey (empreinte / Face ID). La cérémonie WebAuthn établit la
   * session ; `onAuthStateChange` (ci-dessus) relance `hydrate` → fiche médecin +
   * éventuel défi TOTP. On ne fait donc que remonter une erreur éventuelle.
   */
  async function signInWithPasskey() {
    try {
      await passkeySignIn();
      return {};
    } catch (e) {
      return { error: e instanceof Error ? e.message : frAuthError(null) };
    }
  }

  /** Étape TOTP au login : élève la session en aal2 avec le code à 6 chiffres. */
  async function verifyMfa(code: string) {
    try {
      await challengeTotp(code);
      // Session élevée : on lève le défi tout de suite (l'événement
      // MFA_CHALLENGE_VERIFIED relancera aussi `hydrate` par sécurité).
      setMfaRequired(false);
      return {};
    } catch (e) {
      return { error: e instanceof Error ? e.message : frAuthError(null) };
    }
  }

  /** Récupération : un code de secours retire la 2FA (perte d'authentificateur). */
  async function recoverMfa(code: string) {
    try {
      if (!(await redeemRecoveryCode(code))) {
        return { error: 'Code de secours invalide ou déjà utilisé.' };
      }
      // Le facteur TOTP a été retiré : rafraîchir la session pour que
      // `user.factors` (lu localement par l'assurance) reflète sa suppression.
      await getSupabase().auth.refreshSession();
      setMfaRequired(false);
      return {};
    } catch (e) {
      return { error: e instanceof Error ? e.message : frAuthError(null) };
    }
  }

  const isAdmin = !!doctor?.is_admin && !previewMember;

  return (
    <AuthContext.Provider
      value={{
        session,
        doctor,
        loading,
        isAdmin,
        previewMember,
        mfaRequired,
        togglePreviewMember: () => setPreviewMember(v => !v),
        signIn,
        signUp,
        signOut,
        signInWithLink,
        signInWithPasskey,
        verifyMfa,
        recoverMfa,
        refreshDoctor,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
