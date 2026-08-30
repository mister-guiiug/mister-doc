import { Moon, Sun } from 'lucide-react';
import { useThemeContext } from '@mister-guiiug/dev-wpa-config/react/theme-provider';

/**
 * Bascule clair / sombre. L'état vient du `ThemeProvider` monté dans
 * `main.tsx` : un second `useTheme` ferait un deuxième écrivain de
 * `data-theme`.
 */
export function ThemeToggle() {
  const themeCtx = useThemeContext();
  const dark = themeCtx?.resolved === 'dark';
  return (
    <button
      type="button"
      onClick={() => themeCtx?.setTheme(dark ? 'light' : 'dark')}
      title={dark ? 'Thème clair' : 'Thème sombre'}
      aria-label="Changer de thème"
      className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
    >
      {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </button>
  );
}
