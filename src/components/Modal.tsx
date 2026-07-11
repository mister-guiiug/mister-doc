import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Modale accessible : fermeture par Échap / clic sur le fond, piège de focus
 * (Tab reste dans la boîte) et restauration du focus à la fermeture.
 */
export function Modal({
  onClose,
  children,
  className = '',
  labelledBy,
}: {
  onClose: () => void;
  children: ReactNode;
  className?: string;
  labelledBy?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;

    function focusables(): HTMLElement[] {
      if (!boxRef.current) return [];
      return Array.from(
        boxRef.current.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])'
        )
      ).filter(el => el.offsetParent !== null);
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const els = focusables();
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKey);
    // Focus le premier élément interactif de la modale.
    const t = setTimeout(() => focusables()[0]?.focus(), 0);

    return () => {
      document.removeEventListener('keydown', onKey);
      clearTimeout(t);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-end bg-black/40 sm:place-items-center"
      onClick={onClose}
    >
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onClick={e => e.stopPropagation()}
        className={`w-full bg-white shadow-xl dark:bg-slate-900 ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
