import { useCallback, useState } from 'react';

export type Theme = 'light' | 'dark';
const KEY = 'mister-doc:theme';

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

/** Bascule de thème clair/sombre (persistée, alignée sur le script anti-FOUC). */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(currentTheme);

  const apply = useCallback((t: Theme) => {
    document.documentElement.dataset.theme = t;
    document.documentElement.style.colorScheme = t;
    try {
      localStorage.setItem(KEY, t);
    } catch {
      /* ignore */
    }
    setTheme(t);
  }, []);

  const toggle = useCallback(
    () => apply(currentTheme() === 'dark' ? 'light' : 'dark'),
    [apply]
  );

  return { theme, toggle };
}
