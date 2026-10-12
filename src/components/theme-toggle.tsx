import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
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

/**
 * Light or dark. It follows the system until the reader picks one, which is remembered in this
 * browser. Only the host's own UI is themed: a Data App draws itself.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState(initialTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Follow the system for as long as the reader hasn't chosen.
  useEffect(() => {
    const onChange = () => !stored() && setTheme(system.matches ? 'dark' : 'light');
    system.addEventListener('change', onChange);
    return () => system.removeEventListener('change', onChange);
  }, []);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem('theme', next);
    } catch {
      // Not remembered; it still applies for this page.
    }
    setTheme(next);
  };

  const label = theme === 'dark' ? 'Switch to light' : 'Switch to dark';
  return (
    <Button variant="ghost" size="icon" className="size-7" onClick={toggle} aria-label={label} title={label}>
      {theme === 'dark' ? <Sun /> : <Moon />}
    </Button>
  );
}
