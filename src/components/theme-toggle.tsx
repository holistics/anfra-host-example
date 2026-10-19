import { Moon, Sun } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';

type Theme = 'light' | 'dark';

const stored = (): Theme | undefined => {
  try {
    const value = localStorage.getItem('theme');
    return value === 'light' || value === 'dark' ? value : undefined;
  } catch {
    return undefined;
  }
};

const system = window.matchMedia('(prefers-color-scheme: dark)');

/** The theme in use: the reader's choice, once they made one, else the system's. */
export const initialTheme = (): Theme => stored() ?? (system.matches ? 'dark' : 'light');

export const applyTheme = (theme: Theme) =>
  document.documentElement.classList.toggle('dark', theme === 'dark');

let current = initialTheme();
const listeners = new Set<() => void>();

const setTheme = (theme: Theme) => {
  current = theme;
  applyTheme(theme);
  for (const listener of listeners) listener();
};

// Follow the system for as long as the reader hasn't chosen.
system.addEventListener('change', () => {
  if (!stored()) setTheme(system.matches ? 'dark' : 'light');
});

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The theme in use, and a way to flip it, shared by everything that offers the choice. */
export function useTheme(): [Theme, () => void] {
  const theme = useSyncExternalStore(subscribe, () => current);
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem('theme', next);
    } catch {
      // Not remembered; it still applies for this page.
    }
    setTheme(next);
  };
  return [theme, toggle];
}

/**
 * Light or dark. It follows the system until the reader picks one, which is remembered in this
 * browser. Only the host's own UI is themed: a Data App draws itself.
 */
export function ThemeToggle() {
  const [theme, toggle] = useTheme();
  const label = theme === 'dark' ? 'Switch to light' : 'Switch to dark';
  return (
    <Button variant="ghost" size="icon" className="size-7" onClick={toggle} aria-label={label} title={label}>
      {theme === 'dark' ? <Sun /> : <Moon />}
    </Button>
  );
}
