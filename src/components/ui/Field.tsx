import { useId, type InputHTMLAttributes } from 'react';

export interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  /** Message d'erreur (associe `aria-describedby` + `aria-invalid`). */
  error?: string;
}

/**
 * Champ de formulaire labellisé et accessible : `label`/`input` associés par
 * `id` (généré), `aria-invalid` et `aria-describedby` sur erreur.
 */
export function Field({ label, error, className = '', ...rest }: FieldProps) {
  const id = useId();
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="flex flex-col gap-1 text-sm">
      <label htmlFor={id} className="font-medium text-slate-600 dark:text-slate-300">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={`rounded-lg border bg-white px-3 py-2 outline-none transition focus:ring-2 dark:bg-slate-900 ${
          error
            ? 'border-red-400 focus:border-red-500 focus:ring-red-500/30 dark:border-red-700'
            : 'border-slate-300 focus:border-teal-500 focus:ring-teal-500/30 dark:border-slate-600'
        } ${className}`}
        {...rest}
      />
      {error && (
        <span id={errorId} className="text-xs text-red-600 dark:text-red-400">
          {error}
        </span>
      )}
    </div>
  );
}
