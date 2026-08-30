import { createContext, useContext, type ReactNode } from 'react';

export interface ConfirmOptions {
  /** Titre court optionnel au-dessus du message (défaut : `confirm.title`). */
  title?: string;
  message: ReactNode;
  /** Libellé du bouton d'action (défauts du socle : « Confirmer », ou
   *  « Supprimer » si `danger`). */
  confirmLabel?: string;
  /** Libellé du bouton d'annulation (défaut du socle : « Annuler »). */
  cancelLabel?: string;
  /** Action destructive : bouton rouge (`destructive` côté socle). */
  danger?: boolean;
}

/** Ouvre un dialogue de confirmation et résout `true` si l'utilisateur valide. */
export type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

export const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx)
    throw new Error('useConfirm doit être utilisé dans ConfirmProvider');
  return ctx;
}
