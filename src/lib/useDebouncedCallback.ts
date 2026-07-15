import { useEffect, useMemo, useRef } from 'react';

/**
 * Version « anti-rebond » (debounced) de `fn` : les appels rapprochés sont
 * coalescés en un seul, déclenché `delay` ms après le dernier appel. La
 * référence renvoyée est **stable** (ne change pas entre les rendus) et invoque
 * toujours la dernière `fn` fournie.
 *
 * Sert notamment à absorber les rafales d'événements Supabase Realtime : une
 * seule requête de rechargement au lieu d'une par événement (et par table).
 */
export function useDebouncedCallback(fn: () => void, delay: number): () => void {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debounced = useMemo(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        fnRef.current();
      }, delay);
    },
    [delay]
  );

  // Nettoie le minuteur en cours au démontage.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  return debounced;
}
