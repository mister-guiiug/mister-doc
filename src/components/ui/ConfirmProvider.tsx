import { useCallback, useState, type ReactNode } from 'react';
import { ConfirmDialog } from '@mister-guiiug/dev-wpa-config/react/confirm-dialog';
import { useI18n } from '../../i18n/index.ts';
import { ConfirmContext, type ConfirmOptions } from './confirmContext.ts';

interface Pending {
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
}

/**
 * Fournit `useConfirm()` : une confirmation asynchrone (`await confirm({…})`)
 * en remplacement de `window.confirm`. Le pattern provider reste local (une
 * promesse par appel, un seul dialogue rendu) ; la boîte elle-même est le
 * `ConfirmDialog` du socle (`role="alertdialog"`, focus initial sur Annuler,
 * Échap annule, verrou de scroll).
 *
 * Le socle EXIGE un titre (c'est le nom accessible de la boîte) ; quand un
 * appel n'en fournit pas, on pose le générique `confirm.title`.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [pending, setPending] = useState<Pending | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>(resolve => setPending({ options, resolve })),
    []
  );

  // Résout la promesse en cours puis referme (l'updater lit l'état courant :
  // pas de closure périmée sur `pending`).
  const settle = useCallback((value: boolean) => {
    setPending(cur => {
      cur?.resolve(value);
      return null;
    });
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <ConfirmDialog
          open
          title={pending.options.title ?? t('confirm.title')}
          message={pending.options.message}
          confirmLabel={pending.options.confirmLabel}
          cancelLabel={pending.options.cancelLabel}
          destructive={pending.options.danger}
          onConfirm={() => settle(true)}
          onCancel={() => settle(false)}
        />
      )}
    </ConfirmContext.Provider>
  );
}
