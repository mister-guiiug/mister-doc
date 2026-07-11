import { createContext, useContext } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Doctor } from '../backend/types.ts';

export interface AuthValue {
  session: Session | null;
  /** Fiche du médecin connecté (créée à la volée au login). */
  doctor: Doctor | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (
    email: string,
    password: string,
    name: string
  ) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  /** Recharge la fiche du médecin connecté (après approbation, profil, admin…). */
  refreshDoctor: () => Promise<void>;
}

export const AuthContext = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans AuthProvider');
  return ctx;
}
