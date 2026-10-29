import Anthropic from '@anthropic-ai/sdk';
import {
  AiProviderError,
  type AiProvider,
  type AiRequest,
  type ProviderConfig,
} from '../provider.js';

/**
 * Models that take Anthropic's server-side refusal fallback (`fallbacks: "default"`):
 * if one declines a request, the API re-runs it on a fallback model in the same call.
 */
const FALLBACK_MODELS = new Set([
  'claude-fable-5-1',
  'claude-opus-5-5',
  'claude-opus-5',
  'claude-sonnet-5-5',
]);

/** Models that take `output_config.effort`; others (older ones) would answer 400. */
const EFFORT_MODELS = new Set([
  'claude-fable-5-1',
  'claude-fable-5',
  'claude-opus-5-5',
  'claude-opus-5',
  'claude-opus-4-8',
  'claude-opus-4-7',
  'claude-opus-4-6',
  'claude-sonnet-5-5',
  'claude-sonnet-5',
  'claude-sonnet-4-6',
  'claude-haiku-5-5',
]);

/** Claude, through the official Anthropic SDK, with JSON-schema structured output. */
export function createClaudeProvider(config: ProviderConfig): AiProvider {
  if (!config.apiKey) {
    throw new AiProviderError('Add your Anthropic API key (console.anthropic.com) in Settings.');
  }
  const client = new Anthropic({ apiKey: config.apiKey, maxRetries: 2 });

  return {
    id: 'claude',
    async complete({ system, prompt, schema, signal }: AiRequest): Promise<string> {
      try {
        const response = await client.beta.messages.create(
          {
            model: config.model,
            max_tokens: 16000,
            system,
            messages: [{ role: 'user', content: prompt }],
            output_config: {
              format: { type: 'json_schema', schema },
              ...(EFFORT_MODELS.has(config.model) ? { effort: 'medium' as const } : {}),
            },
            ...(FALLBACK_MODELS.has(config.model)
              ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }
              : {}),
          },
          { signal },
        );
        if (response.stop_reason === 'refusal') {
          throw new AiProviderError('Claude declined to answer this request.');
        }
        if (response.stop_reason === 'max_tokens') {
          throw new AiProviderError("Claude's answer was cut off. Try again.");
        }
        return response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
      } catch (err) {
        throw explain(err);
      }
    },
  };
}

/** Turns SDK errors into messages for the player (never the raw error: it can echo request details). */
function explain(err: unknown): unknown {
  if (err instanceof AiProviderError) return err;
  if (err instanceof Anthropic.APIUserAbortError) return err;
  if (err instanceof Anthropic.AuthenticationError) {
    return new AiProviderError('Anthropic rejected the API key. Check it in Settings.');
  }
  if (err instanceof Anthropic.NotFoundError) {
    return new AiProviderError('Anthropic does not know that model name. Check it in Settings.');
  }
  if (err instanceof Anthropic.BadRequestError) {
    return new AiProviderError(
      'Anthropic rejected the request. This model may not support structured answers: try claude-opus-5-5.',
    );
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new AiProviderError('Anthropic says too many requests. Wait a moment and try again.');
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new AiProviderError("Couldn't reach Anthropic. Check your internet connection.");
  }
  if (err instanceof Anthropic.APIError) {
    return new AiProviderError(`Anthropic answered with an error (${String(err.status)}).`);
  }
  return err;
}
