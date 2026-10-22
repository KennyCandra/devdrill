import path from 'node:path';
import type { ChallengeStatus, ProgressEntry, Settings } from '@bughunt/shared';
import { HttpError } from '../httpError.js';
import { JsonStore } from './jsonStore.js';

export interface ProgressFile {
  challenges: Record<string, ProgressEntry>;
}

export const DEFAULT_SETTINGS: Settings = { timerEnabled: false, theme: 'system' };

const STATUSES: readonly ChallengeStatus[] = ['not_started', 'in_progress', 'solved'];
const THEMES: readonly Settings['theme'][] = ['system', 'light', 'dark'];

export function createProgressStore(dataDir: string): JsonStore<ProgressFile> {
  return new JsonStore(path.join(dataDir, 'progress.json'), parseProgressFile, () => ({
    challenges: {},
  }));
}

export function createSettingsStore(dataDir: string): JsonStore<Settings> {
  return new JsonStore(path.join(dataDir, 'settings.json'), parseSettingsFile, () => ({
    ...DEFAULT_SETTINGS,
  }));
}

export function emptyProgress(): ProgressEntry {
  return { status: 'not_started', attempts: 0 };
}

/** Lenient: keeps every valid entry and drops the rest. */
function parseProgressFile(raw: unknown): ProgressFile {
  const source = (raw as { challenges?: unknown } | null)?.challenges;
  if (typeof source !== 'object' || source === null) throw new Error('bad progress file');

  const entries: [string, ProgressEntry][] = [];
  for (const [id, value] of Object.entries(source)) {
    const e = value as Partial<ProgressEntry>;
    if (!STATUSES.includes(e.status as ChallengeStatus) || typeof e.attempts !== 'number') continue;
    entries.push([
      id,
      {
        status: e.status as ChallengeStatus,
        attempts: e.attempts,
        ...(typeof e.startedAt === 'string' ? { startedAt: e.startedAt } : {}),
        ...(typeof e.bestTimeMs === 'number' ? { bestTimeMs: e.bestTimeMs } : {}),
        ...(typeof e.solvedAt === 'string' ? { solvedAt: e.solvedAt } : {}),
      },
    ]);
  }
  // fromEntries defines own properties, so a "__proto__" id can't change the prototype.
  return { challenges: Object.fromEntries(entries) };
}

/**
 * Lenient: a file written by a newer version (unknown keys) or with one bad value
 * keeps every other setting instead of resetting everything.
 */
function parseSettingsFile(raw: unknown): Settings {
  const data = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  return {
    timerEnabled:
      typeof data.timerEnabled === 'boolean' ? data.timerEnabled : DEFAULT_SETTINGS.timerEnabled,
    theme: THEMES.includes(data.theme as Settings['theme'])
      ? (data.theme as Settings['theme'])
      : DEFAULT_SETTINGS.theme,
  };
}

/** Strict: validates a settings change from a request body; throws a 400 on bad values. */
export function parseSettingsPatch(raw: unknown): Partial<Settings> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new HttpError(400, 'Settings must be an object.');
  }
  const data = raw as Record<string, unknown>;
  const patch: Partial<Settings> = {};

  for (const key of Object.keys(data)) {
    if (!Object.hasOwn(DEFAULT_SETTINGS, key))
      throw new HttpError(400, `Unknown setting "${key}".`);
  }
  if ('timerEnabled' in data) {
    if (typeof data.timerEnabled !== 'boolean') {
      throw new HttpError(400, '"timerEnabled" must be true or false.');
    }
    patch.timerEnabled = data.timerEnabled;
  }
  if ('theme' in data) {
    if (!THEMES.includes(data.theme as Settings['theme'])) {
      throw new HttpError(400, `"theme" must be one of: ${THEMES.join(', ')}.`);
    }
    patch.theme = data.theme as Settings['theme'];
  }
  return patch;
}
