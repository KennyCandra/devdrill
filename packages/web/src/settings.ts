import { createContext, useContext } from 'react';
import type { Settings } from '@bughunt/shared';
import { DEFAULT_SETTINGS } from './defaults';

export interface SettingsValue {
  settings: Settings;
  /** Saves a change on the server and applies it everywhere once saved. */
  update: (patch: Partial<Settings>) => Promise<void>;
}

const SettingsContext = createContext<SettingsValue>({
  settings: DEFAULT_SETTINGS,
  update: () => Promise.resolve(),
});

export const SettingsProvider = SettingsContext.Provider;
export const useSettings = () => useContext(SettingsContext);
