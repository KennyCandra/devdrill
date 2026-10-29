import path from 'node:path';
import type {
  AiProviderId,
  AiProviderSettings,
  AiSettings,
  AiSettingsPatch,
} from '@devdrill/shared';
import { HttpError } from '../httpError.js';
import { JsonStore } from '../services/jsonStore.js';
import type { ProviderConfig } from './provider.js';
import { PROVIDER_IDS, PROVIDERS } from './registry.js';

/** `~/.devdrill/ai.json`: which provider is on, and each provider's model, URL and key. */
export interface AiConfigFile {
  active: AiProviderId | null;
  providers: Record<AiProviderId, ProviderConfig>;
}

const MAX_KEY_LENGTH = 500;
const MAX_MODEL_LENGTH = 200;

export function defaultAiConfig(): AiConfigFile {
  return {
    active: null,
    providers: Object.fromEntries(
      PROVIDER_IDS.map((id) => [
        id,
        {
          model: PROVIDERS[id].info.defaultModel,
          baseUrl: PROVIDERS[id].info.defaultBaseUrl,
          apiKey: null,
        },
      ]),
    ) as Record<AiProviderId, ProviderConfig>,
  };
}

/**
 * The AI settings file. Keys are secrets: the file is written owner-only, and only
 * `publicSettings()` (keys replaced by `hasKey`) ever goes to the browser.
 */
export class AiConfigStore {
  private readonly store: JsonStore<AiConfigFile>;

  constructor(file: string) {
    // Owner-only from the first byte: it holds API keys.
    this.store = new JsonStore(file, parseAiConfig, defaultAiConfig, 0o600);
  }

  static inDataDir(dataDir: string): AiConfigStore {
    return new AiConfigStore(path.join(dataDir, 'ai.json'));
  }

  get(): Promise<AiConfigFile> {
    return this.store.get();
  }

  async publicSettings(): Promise<AiSettings> {
    return toPublic(await this.store.get());
  }

  async update(raw: unknown): Promise<AiSettings> {
    const patch = parsePatch(raw);
    return toPublic(await this.store.update((config) => applyPatch(config, patch)));
  }
}

function toPublic(config: AiConfigFile): AiSettings {
  return {
    active: config.active,
    providers: Object.fromEntries(
      PROVIDER_IDS.map((id) => {
        const p = config.providers[id];
        const shown: AiProviderSettings = {
          model: p.model,
          baseUrl: p.baseUrl,
          hasKey: p.apiKey !== null,
        };
        return [id, shown];
      }),
    ) as Record<AiProviderId, AiProviderSettings>,
    available: PROVIDER_IDS.map((id) => PROVIDERS[id].info),
  };
}

function applyPatch(config: AiConfigFile, patch: AiSettingsPatch): AiConfigFile {
  if (patch.active !== undefined) config.active = patch.active;
  if (patch.provider) {
    const p = config.providers[patch.provider];
    if (patch.model !== undefined) p.model = patch.model;
    if (patch.baseUrl !== undefined && patch.baseUrl !== p.baseUrl) {
      p.baseUrl = patch.baseUrl;
      // The key was given for the old server. Keeping it would send it to the new URL, which
      // anyone who can open the app could point at their own server to collect it.
      if (patch.apiKey === undefined) p.apiKey = null;
    }
    if (patch.apiKey !== undefined) p.apiKey = patch.apiKey;
  }
  return config;
}

const isProvider = (v: unknown): v is AiProviderId =>
  typeof v === 'string' && (PROVIDER_IDS as string[]).includes(v);

/** Validates a settings change from the UI. Throws a 400 that says what's wrong. */
export function parsePatch(raw: unknown): AiSettingsPatch {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new HttpError(400, 'Send the AI settings as an object.');
  }
  const body = raw as Record<string, unknown>;
  const patch: AiSettingsPatch = {};

  if ('active' in body) {
    if (body.active !== null && !isProvider(body.active)) {
      throw new HttpError(400, `"active" must be one of ${PROVIDER_IDS.join(', ')}, or null.`);
    }
    patch.active = body.active;
  }

  const fields = ['model', 'baseUrl', 'apiKey'].filter((f) => f in body);
  if (fields.length > 0 || 'provider' in body) {
    if (!isProvider(body.provider)) {
      throw new HttpError(400, `"provider" must be one of ${PROVIDER_IDS.join(', ')}.`);
    }
    patch.provider = body.provider;
  }

  if ('model' in body) {
    if (
      typeof body.model !== 'string' ||
      !body.model.trim() ||
      body.model.length > MAX_MODEL_LENGTH
    ) {
      throw new HttpError(400, '"model" must be a model name.');
    }
    patch.model = body.model.trim();
  }

  if ('baseUrl' in body) {
    if (body.baseUrl === null || body.baseUrl === '') {
      patch.baseUrl = null;
    } else {
      patch.baseUrl = parseBaseUrl(body.baseUrl);
    }
  }

  if ('apiKey' in body) {
    if (body.apiKey === null || body.apiKey === '') {
      patch.apiKey = null;
    } else if (
      typeof body.apiKey !== 'string' ||
      body.apiKey.length > MAX_KEY_LENGTH ||
      /\s/.test(body.apiKey.trim())
    ) {
      throw new HttpError(400, '"apiKey" must be a key without spaces.');
    } else {
      patch.apiKey = body.apiKey.trim();
    }
  }
  return patch;
}

function parseBaseUrl(value: unknown): string {
  if (typeof value !== 'string') throw new HttpError(400, '"baseUrl" must be a URL.');
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new HttpError(400, '"baseUrl" must be a full URL, like http://localhost:11434.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new HttpError(400, '"baseUrl" must start with http:// or https://.');
  }
  // A password in the URL would be stored in the open and shown in Settings: keys go in the
  // key field. Queries and fragments aren't part of an API base URL.
  if (url.username || url.password || url.search || url.hash) {
    throw new HttpError(400, '"baseUrl" must be a plain URL: no user:password@, ?query or #part.');
  }
  // Keep a path (e.g. /v1) but drop a trailing slash, so joining paths is predictable.
  return url.toString().replace(/\/+$/, '');
}

/** Lenient: unknown providers and broken entries fall back to the defaults. */
function parseAiConfig(raw: unknown): AiConfigFile {
  const config = defaultAiConfig();
  const file = raw as Partial<{ active: unknown; providers: Record<string, unknown> }> | null;
  if (!file || typeof file !== 'object') throw new Error('not an AI config');
  if (isProvider(file.active)) config.active = file.active;
  for (const id of PROVIDER_IDS) {
    const p = file.providers?.[id] as Partial<Record<keyof ProviderConfig, unknown>> | undefined;
    if (!p) continue;
    if (typeof p.model === 'string' && p.model) config.providers[id].model = p.model;
    if (typeof p.baseUrl === 'string' || p.baseUrl === null)
      config.providers[id].baseUrl = p.baseUrl;
    if (typeof p.apiKey === 'string' || p.apiKey === null) config.providers[id].apiKey = p.apiKey;
  }
  return config;
}
