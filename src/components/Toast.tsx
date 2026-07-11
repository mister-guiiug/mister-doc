import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

type ToastKind = 'success' | 'error';
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast doit être utilisé dans ToastProvider');
  return ctx;
}

let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts(t => t.filter(x => x.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = ++counter;
      setToasts(t => [...t, { id, kind, message }]);
      setTimeout(() => remove(id), 4000);
    },
    [remove]
  );

  const api: ToastApi = {
    success: m => push('success', m),
    error: m => push('error', m),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {toasts.map(t => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex w-full max-w-sm items-center gap-2 rounded-xl border px-3 py-2.5 text-sm shadow-lg ${
              t.kind === 'success'
                ? 'border-teal-200 bg-white text-slate-800 dark:border-teal-900 dark:bg-slate-800 dark:text-slate-100'
                : 'border-red-200 bg-white text-slate-800 dark:border-red-900 dark:bg-slate-800 dark:text-slate-100'
            }`}
          >
            {t.kind === 'success' ? (
              <CheckCircle2 className="size-5 shrink-0 text-teal-600" />
            ) : (
              <AlertCircle className="size-5 shrink-0 text-red-600" />
            )}
            <span className="min-w-0 flex-1">{t.message}</span>
            <button
              onClick={() => remove(t.id)}
              aria-label="Fermer"
              className="shrink-0 text-slate-400 hover:text-slate-600"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
