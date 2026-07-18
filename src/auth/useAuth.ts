import { createContext, useContext } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Doctor } from '../backend/types.ts';

export interface AuthValue {
  session: Session | null;
  /** Fiche du médecin connecté (créée à la volée au login). */
  doctor: Doctor | null;
  loading: boolean;
  /**
   * Admin EFFECTIF pour l'affichage : vrai si le compte est admin ET que la vue
   * « aperçu médecin » n'est pas active. À utiliser pour toutes les portes
   * d'interface admin (nav, verrou, /admin, /compteurs).
   */
  isAdmin: boolean;
  /** Vrai si un admin a activé l'aperçu « comme un médecin non-admin ». */
  previewMember: boolean;
  /**
   * Vrai si la session est authentifiée par mot de passe mais qu'un facteur TOTP
   * vérifié impose encore l'étape à 6 chiffres (aal1→aal2) avant l'accès à l'app.
   */
  mfaRequired: boolean;
  /** Bascule l'aperçu médecin (sans effet si le compte n'est pas admin). */
  togglePreviewMember: () => void;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (
    email: string,
    password: string,
    name: string
  ) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  /** Valide le code TOTP à 6 chiffres au login (élève la session en aal2). */
  verifyMfa: (code: string) => Promise<{ error?: string }>;
  /** Recharge la fiche du médecin connecté (après approbation, profil, admin…). */
  refreshDoctor: () => Promise<void>;
}

export const AuthContext = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans AuthProvider');
  return ctx;
}
