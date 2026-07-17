import { useCallback, useState, type ReactNode } from 'react';
import { ConfirmContext, type ConfirmOptions } from './confirmContext.ts';
import { ConfirmDialog } from './ConfirmDialog.tsx';

interface Pending {
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
}

/**
 * Fournit `useConfirm()` : une confirmation asynchrone (`await confirm({…})`)
 * rendue via un `ConfirmDialog` unique, en remplacement de `window.confirm`.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
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
          options={pending.options}
          onConfirm={() => settle(true)}
          onCancel={() => settle(false)}
        />
      )}
    </ConfirmContext.Provider>
  );
}
