import OpenAI from 'openai';
import {
  AiProviderError,
  type AiProvider,
  type AiRequest,
  type ProviderConfig,
} from '../provider.js';

/**
 * Anything that speaks the OpenAI Chat Completions API: OpenAI itself, and (as "custom")
 * DeepSeek, OpenRouter, LM Studio, vLLM… OpenAI gets a strict JSON schema; other servers
 * often only support plain JSON mode, so they're asked for a JSON object and told the
 * schema in the prompt (the service validates the answer either way).
 */
export function createOpenAiCompatibleProvider(
  config: ProviderConfig,
  kind: 'openai' | 'custom',
): AiProvider {
  const name = kind === 'openai' ? 'OpenAI' : 'The server';
  if (kind === 'openai' && !config.apiKey) {
    throw new AiProviderError('Add your OpenAI API key (platform.openai.com) in Settings.');
  }
  if (kind === 'custom' && !config.baseUrl) {
    throw new AiProviderError('Add the server URL (e.g. https://api.deepseek.com/v1) in Settings.');
  }
  const client = new OpenAI({
    // Local servers often need no key, but the SDK wants one.
    apiKey: config.apiKey ?? 'not-needed',
    ...(kind === 'custom' && config.baseUrl ? { baseURL: config.baseUrl } : {}),
    maxRetries: 2,
  });

  return {
    id: kind,
    async complete({ system, prompt, schema, signal }: AiRequest): Promise<string> {
      const ask = (format: 'schema' | 'json' | 'none') =>
        client.chat.completions.create(
          {
            model: config.model,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: prompt },
            ],
            ...(format === 'schema'
              ? {
                  response_format: {
                    type: 'json_schema' as const,
                    json_schema: { name: 'answer', schema, strict: false },
                  },
                }
              : format === 'json'
                ? { response_format: { type: 'json_object' as const } }
                : {}),
          },
          { signal },
        );
      try {
        let response;
        try {
          response = await ask(kind === 'openai' ? 'schema' : 'json');
        } catch (err) {
          // Some OpenAI-compatible servers (LM Studio…) refuse JSON mode: ask again without
          // it; the prompt still asks for JSON and the service checks it.
          if (
            kind !== 'custom' ||
            !(err instanceof OpenAI.BadRequestError) ||
            !/response_format|json/i.test(err.message)
          ) {
            throw err;
          }
          response = await ask('none');
        }
        const choice = response.choices[0];
        if (choice?.message.refusal) {
          throw new AiProviderError(`${name} declined to answer this request.`);
        }
        if (choice?.finish_reason === 'length') {
          throw new AiProviderError(`${name}'s answer was cut off. Try again.`);
        }
        const text = choice?.message.content;
        if (!text) throw new AiProviderError(`${name} sent an empty answer.`);
        return text;
      } catch (err) {
        throw explain(err, name);
      }
    },
  };
}

function explain(err: unknown, name: string): unknown {
  if (err instanceof AiProviderError || err instanceof OpenAI.APIUserAbortError) return err;
  if (err instanceof OpenAI.AuthenticationError) {
    return new AiProviderError(`${name} rejected the API key. Check it in Settings.`);
  }
  if (err instanceof OpenAI.NotFoundError) {
    return new AiProviderError(`${name} does not know that model name (or the URL is wrong).`);
  }
  if (err instanceof OpenAI.RateLimitError) {
    return new AiProviderError(`${name} says too many requests. Wait a moment and try again.`);
  }
  if (err instanceof OpenAI.APIConnectionError) {
    return new AiProviderError(`Couldn't reach ${name === 'OpenAI' ? 'OpenAI' : 'the server'}.`);
  }
  if (err instanceof OpenAI.APIError) {
    return new AiProviderError(`${name} answered with an error (${String(err.status)}).`);
  }
  return err;
}
