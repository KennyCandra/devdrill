import {
  AiProviderError,
  type AiProvider,
  type AiRequest,
  type ProviderConfig,
} from '../provider.js';
import { requestJson } from './http.js';

/** A local model through Ollama's own API (`ollama serve`), with its JSON-schema `format`. */
export function createOllamaProvider(config: ProviderConfig): AiProvider {
  const base = config.baseUrl ?? 'http://localhost:11434';
  return {
    id: 'ollama',
    async complete({ system, prompt, schema, signal }: AiRequest): Promise<string> {
      const answer = await requestJson<{ message?: { content?: string }; error?: string }>(
        'Ollama',
        `${base}/api/chat`,
        {
          body: {
            model: config.model,
            stream: false,
            format: schema,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: prompt },
            ],
          },
          signal,
        },
      );
      if (answer.error) throw new AiProviderError(`Ollama: ${answer.error}`);
      const text = answer.message?.content;
      if (!text) throw new AiProviderError('Ollama sent an empty answer. Is the model pulled?');
      return text;
    },
  };
}
