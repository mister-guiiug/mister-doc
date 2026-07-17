import { createContext, useContext, type ReactNode } from 'react';

export interface ConfirmOptions {
  /** Titre court optionnel (gras) au-dessus du message. */
  title?: string;
  message: ReactNode;
  /** Libellé du bouton d'action (défaut « Confirmer »). */
  confirmLabel?: string;
  /** Libellé du bouton d'annulation (défaut « Annuler »). */
  cancelLabel?: string;
  /** Action destructive : bouton rouge. */
  danger?: boolean;
}

/** Ouvre un dialogue de confirmation et résout `true` si l'utilisateur valide. */
export type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

export const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm doit être utilisé dans ConfirmProvider');
  return ctx;
}
