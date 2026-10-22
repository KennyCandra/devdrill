import { useEffect, useState } from 'react';
import type { Settings } from '@bughunt/shared';

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
