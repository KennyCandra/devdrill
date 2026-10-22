import { createContext, useContext, useEffect, useState } from 'react';
import type { Settings } from '@devdrill/shared';

export type ResolvedTheme = 'dark' | 'light';

const prefersLight = () => window.matchMedia('(prefers-color-scheme: light)');

/** Applies the theme setting to <html data-theme> and returns the resolved theme. */
export function useTheme(setting: Settings['theme']): ResolvedTheme {
  const [systemLight, setSystemLight] = useState(() => prefersLight().matches);

  useEffect(() => {
    const query = prefersLight();
    const onChange = () => setSystemLight(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const resolved: ResolvedTheme = setting === 'system' ? (systemLight ? 'light' : 'dark') : setting;

  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
  }, [resolved]);

  return resolved;
}

const ThemeContext = createContext<ResolvedTheme>('dark');
export const ThemeProvider = ThemeContext.Provider;
export const useResolvedTheme = () => useContext(ThemeContext);

/** Sets the theme before React renders, so light-mode users don't see a dark flash. */
export function applyInitialTheme(): void {
  document.documentElement.dataset.theme = prefersLight().matches ? 'light' : 'dark';
}
