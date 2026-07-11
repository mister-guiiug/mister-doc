import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabase } from '../lib/supabase.ts';
import { ensureSelfDoctor } from '../backend/doctors.ts';
import type { Doctor } from '../backend/types.ts';
import { AuthContext } from './useAuth.ts';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshDoctor = useCallback(async () => {
    const sb = getSupabase();
    const { data } = await sb.auth.getSession();
    if (!data.session) {
      setDoctor(null);
      return;
    }
    try {
      const name =
        (data.session.user.user_metadata?.full_name as string | undefined) ??
        undefined;
      setDoctor(await ensureSelfDoctor(name));
    } catch {
      setDoctor(null);
    }
  }, []);

  useEffect(() => {
    const sb = getSupabase();

    async function hydrate(s: Session | null) {
      setSession(s);
      if (s) {
        try {
          const name =
            (s.user.user_metadata?.full_name as string | undefined) ??
            undefined;
          setDoctor(await ensureSelfDoctor(name));
        } catch {
          setDoctor(null);
        }
      } else {
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
    return { error: error?.message };
  }

  async function signUp(email: string, password: string, name: string) {
    const { error } = await getSupabase().auth.signUp({
      email,
      password,
      options: { data: { full_name: name.trim() } },
    });
    return { error: error?.message };
  }

  async function signOut() {
    await getSupabase().auth.signOut();
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        doctor,
        loading,
        signIn,
        signUp,
        signOut,
        refreshDoctor,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
