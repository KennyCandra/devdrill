import type { AiProviderId } from '@devdrill/shared';

/**
 * The one interface every AI provider implements (docs/V1_2_PLAN.md). The rest of the
 * app only ever talks to this, so providers can be added or swapped without touching it.
 */
export interface AiProvider {
  readonly id: AiProviderId | 'fake';
  /**
   * Sends one request and returns the model's text answer: JSON matching `schema`.
   * Providers that support structured output pass the schema on; the others are told
   * in the prompt. The service validates the answer either way.
   */
  complete(request: AiRequest): Promise<string>;
}

export interface AiRequest {
  /** Who the model is and how it answers: stable across calls of the same feature. */
  system: string;
  /** The task: the challenge, the player's work. */
  prompt: string;
  /** JSON Schema of the answer (an object). */
  schema: JsonSchema;
  /** Stops the request: the player left, or it took too long. */
  signal: AbortSignal;
}

/** A plain JSON Schema object, as the providers' structured-output options take it. */
export type JsonSchema = Record<string, unknown>;

/** One provider's saved settings, key included: server-side only. */
export interface ProviderConfig {
  model: string;
  baseUrl: string | null;
  apiKey: string | null;
}

/**
 * A provider failure with a message for the player (no key, wrong URL, model not found).
 * Anything else that's thrown is reported as a generic failure, so a message from an SDK
 * can never leak a key.
 */
export class AiProviderError extends Error {
  override readonly name = 'AiProviderError';
}
