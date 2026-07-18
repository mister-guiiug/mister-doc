import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabase } from '../lib/supabase.ts';
import { ensureSelfDoctor } from '../backend/doctors.ts';
import { getSettings } from '../backend/settings.ts';
import {
  challengeTotp,
  getAssuranceLevel,
  mfaChallengeNeeded,
  redeemRecoveryCode,
} from '../backend/mfa.ts';
import { setIncludePentecote } from '../lib/dates.ts';
import { frAuthError } from '../lib/authErrors.ts';
import { idbGet, idbSet } from '../lib/idbCache.ts';
import type { Doctor } from '../backend/types.ts';
import { AuthContext } from './useAuth.ts';

/** Charge les réglages et configure les jours fériés (best-effort). */
async function applySettings(approved: boolean) {
  if (!approved) return;
  try {
    const s = await getSettings();
    setIncludePentecote(s.pentecote_ferie !== false);
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

  async function signOut() {
    setPreviewMember(false);
    await getSupabase().auth.signOut();
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
        verifyMfa,
        recoverMfa,
        refreshDoctor,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
