import type { AiProviderId, AiSettings, AiTestResult } from '@devdrill/shared';
import { HttpError } from '../httpError.js';
import type { AiConfigStore } from './config.js';
import { AiProviderError, type AiProvider, type JsonSchema } from './provider.js';
import { PROVIDER_IDS, PROVIDERS } from './registry.js';

/** One thing the AI does: its prompt, the shape of its answer, and how to check it. */
export interface AiFeature<T> {
  system: string;
  prompt: string;
  schema: JsonSchema;
  /** Checks the parsed answer and returns it typed; throws if it doesn't fit. */
  parse: (value: unknown) => T;
}

/** Long enough for a slow local model, short enough that a stuck request doesn't hang the page. */
const TIMEOUT_MS = 120_000;

/**
 * The AI features' way in: picks the provider from the settings, runs a feature on it,
 * and checks the answer. Errors come out as HttpErrors with messages for the player.
 */
export class AiService {
  constructor(
    private readonly config: AiConfigStore,
    /** Tests use a fake provider instead of the configured one. */
    private readonly override?: AiProvider,
  ) {}

  settings(): Promise<AiSettings> {
    return this.config.publicSettings();
  }

  update(raw: unknown): Promise<AiSettings> {
    return this.config.update(raw);
  }

  /** True when a provider is chosen and set up enough to try, so the UI shows the AI buttons. */
  async enabled(): Promise<boolean> {
    if (this.override) return true;
    try {
      await this.provider();
      return true;
    } catch {
      return false;
    }
  }

  /** Runs a feature on the active provider. `abort` stops it (e.g. the player left). */
  async run<T>(feature: AiFeature<T>, abort?: AbortSignal): Promise<T> {
    return this.runOn(await this.provider(), feature, abort);
  }

  /** "Test connection": a tiny request to one provider (the active one by default). */
  async test(raw: unknown): Promise<AiTestResult> {
    const requested = (raw as { provider?: unknown } | null)?.provider;
    if (requested !== undefined && !PROVIDER_IDS.includes(requested as AiProviderId)) {
      throw new HttpError(400, `"provider" must be one of ${PROVIDER_IDS.join(', ')}.`);
    }
    const started = Date.now();
    try {
      const provider = await this.provider(requested as AiProviderId | undefined);
      const answer = await this.runOn(provider, CONNECTION_TEST);
      return {
        ok: true,
        message: `It works: the model answered "${answer.reply}".`,
        durationMs: Date.now() - started,
      };
    } catch (err) {
      if (!(err instanceof HttpError)) throw err;
      return { ok: false, message: err.message, durationMs: Date.now() - started };
    }
  }

  private async provider(id?: AiProviderId): Promise<AiProvider> {
    if (this.override) return this.override;
    const config = await this.config.get();
    const chosen = id ?? config.active;
    if (!chosen) throw new HttpError(409, 'Choose an AI provider in Settings first.');
    try {
      return PROVIDERS[chosen].create(config.providers[chosen]);
    } catch (err) {
      if (err instanceof AiProviderError) throw new HttpError(400, err.message);
      throw err;
    }
  }

  private async runOn<T>(
    provider: AiProvider,
    feature: AiFeature<T>,
    abort?: AbortSignal,
  ): Promise<T> {
    const timeout = AbortSignal.timeout(TIMEOUT_MS);
    const signal = abort ? AbortSignal.any([timeout, abort]) : timeout;
    let text: string;
    try {
      text = await provider.complete({
        // Every provider is also told in words, for those without structured output.
        system: `${feature.system}\n\nAnswer with only a JSON object that matches this JSON Schema, and nothing else:\n${JSON.stringify(feature.schema)}`,
        prompt: feature.prompt,
        schema: feature.schema,
        signal,
      });
    } catch (err) {
      if (timeout.aborted) {
        throw new HttpError(
          504,
          `The AI took longer than ${TIMEOUT_MS / 60_000} minutes. Try again.`,
        );
      }
      if (abort?.aborted) throw new HttpError(499, 'Cancelled.');
      if (err instanceof AiProviderError) throw new HttpError(502, err.message);
      // Unknown errors may carry request details: log the type only, tell the player plainly.
      console.error(`AI request failed (${provider.id}): ${(err as Error).name ?? 'error'}`);
      throw new HttpError(502, 'The AI request failed. Check the AI settings and try again.');
    }

    try {
      return feature.parse(JSON.parse(extractJson(text)));
    } catch {
      throw new HttpError(502, "The AI's answer didn't make sense. Try again.");
    }
  }
}

/**
 * The JSON object in a model's answer. Models add things around it: Markdown fences,
 * `<think>` blocks from reasoning models, a sentence before or after. Tries the whole text,
 * then each `{` in turn up to its matching `}` (strings are skipped, so braces inside them
 * don't count), and returns the first that parses as an object.
 */
export function extractJson(text: string): string {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  if (isJsonObject(cleaned)) return cleaned;
  for (let start = cleaned.indexOf('{'); start !== -1; start = cleaned.indexOf('{', start + 1)) {
    const end = matchingBrace(cleaned, start);
    if (end !== -1 && isJsonObject(cleaned.slice(start, end + 1))) {
      return cleaned.slice(start, end + 1);
    }
  }
  throw new Error('no JSON object');
}

function isJsonObject(text: string): boolean {
  try {
    const value: unknown = JSON.parse(text);
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  } catch {
    return false;
  }
}

/** The index of the `}` closing the `{` at `start`, or -1. */
function matchingBrace(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === '\\') i++;
      else if (ch === '"') inString = false;
    } else if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}' && --depth === 0) {
      return i;
    }
  }
  return -1;
}

const CONNECTION_TEST: AiFeature<{ reply: string }> = {
  system: 'You are checking that a connection works. Be brief.',
  prompt: 'Reply with the word "ready" in the "reply" field.',
  schema: {
    type: 'object',
    properties: { reply: { type: 'string' } },
    required: ['reply'],
    additionalProperties: false,
  },
  parse: (value) => {
    const reply = (value as { reply?: unknown } | null)?.reply;
    if (typeof reply !== 'string') throw new Error('no reply');
    return { reply: reply.slice(0, 40) };
  },
};
