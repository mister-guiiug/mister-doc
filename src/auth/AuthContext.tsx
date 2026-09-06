import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabase, subscribeTable } from '../lib/supabase.ts';
import { ensureSelfDoctor } from '../backend/doctors.ts';
import { getSettings } from '../backend/settings.ts';
import { listShiftTypes } from '../backend/shiftTypes.ts';
import { setShiftTypes } from '../lib/shifts.ts';
import {
  challengeTotp,
  getAssuranceLevel,
  mfaChallengeNeeded,
  redeemRecoveryCode,
} from '../backend/mfa.ts';
import { signInWithPasskey as passkeySignIn } from '../backend/passkey.ts';
import { setIncludePentecote } from '../lib/dates.ts';
import { frAuthError } from '../lib/authErrors.ts';
import { idbGet, idbSet } from '../lib/idbCache.ts';
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

    async function hydrate(s: Session | null) {
      setSession(s);
      if (s) {
        // Défi TOTP éventuel : lecture locale de l'assurance (claim `aal` +
        // facteurs de la session). Best-effort → hors-ligne on ne bloque pas.
        try {
          setMfaRequired(mfaChallengeNeeded(await getAssuranceLevel()));
        } catch {
          setMfaRequired(false);
        }
        const key = `self-doctor:${s.user.id}`;
        try {
          const name =
            (s.user.user_metadata?.full_name as string | undefined) ??
            undefined;
          const d = await ensureSelfDoctor(name);
          setDoctor(d);
          void idbSet(key, d);
          await applySettings(d.approved);
        } catch {
          // Hors-ligne / réseau : replier sur le médecin en cache pour rester
          // utilisable (consultation du planning mis en cache).
          setDoctor((await idbGet<Doctor>(key)) ?? null);
        }
      } else {
        setMfaRequired(false);
        setDoctor(null);
      }
      setLoading(false);
    }

    sb.auth.getSession().then(({ data }) => hydrate(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((_event, s) => {
      void hydrate(s);
    });
    return () => sub.subscription.unsubscribe();
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

  async function signOut() {
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
