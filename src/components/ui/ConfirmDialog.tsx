import { Modal } from '../Modal.tsx';
import { Button } from './Button.tsx';
import type { ConfirmOptions } from './confirmContext.ts';

/**
 * Dialogue de confirmation accessible (bâti sur `Modal` : Échap, piège de focus,
 * restauration). Remplace `window.confirm`. Le bouton « Annuler » est le premier
 * focusé (choix sûr pour une action destructive).
 */
export function ConfirmDialog({
  options,
  onConfirm,
  onCancel,
}: {
  options: ConfirmOptions;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const {
    title,
    message,
    confirmLabel = 'Confirmer',
    cancelLabel = 'Annuler',
    danger = false,
  } = options;
  return (
    <Modal onClose={onCancel} className="max-w-sm rounded-t-2xl p-5 sm:rounded-2xl">
      {title && (
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
          {title}
        </h2>
      )}
      <p
        className={`text-sm text-slate-600 dark:text-slate-300 ${title ? 'mt-1' : ''}`}
      >
        {message}
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
