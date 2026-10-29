import {
  AiProviderError,
  type AiProvider,
  type AiRequest,
  type ProviderConfig,
} from '../provider.js';
import { requestJson } from './http.js';

/**
 * OpenCode's local server (`opencode serve`), which forwards to whatever providers you've
 * connected in OpenCode (DeepSeek, Claude, local models…).
 *
 * Model: "providerID/modelID" as OpenCode names them (e.g. "deepseek/deepseek-chat"), or
 * "default" for OpenCode's default model. Key: the server password, if you set
 * OPENCODE_SERVER_PASSWORD.
 *
 * OpenCode is an agent that can run tools (edit files, run commands) in its folder. Our
 * requests contain a player's code, so every tool it ships with is switched off: we only
 * want an answer.
 */
const TOOLS_OFF = Object.fromEntries(
  [
    'bash',
    'edit',
    'write',
    'patch',
    'multiedit',
    'read',
    'list',
    'glob',
    'grep',
    'webfetch',
    'websearch',
    'todowrite',
    'todoread',
    'task',
  ].map((tool) => [tool, false]),
);

interface PromptResponse {
  info?: { structured?: unknown; error?: { name?: string; data?: { message?: string } } };
  parts?: { type?: string; text?: string }[];
}

export function createOpenCodeProvider(config: ProviderConfig): AiProvider {
  const base = config.baseUrl ?? 'http://127.0.0.1:4096';
  const headers: Record<string, string> = config.apiKey
    ? { Authorization: `Basic ${Buffer.from(`opencode:${config.apiKey}`).toString('base64')}` }
    : {};
  const [providerID, ...rest] = config.model.split('/');
  const model =
    config.model === 'default' || rest.length === 0
      ? undefined
      : { providerID, modelID: rest.join('/') };

  return {
    id: 'opencode',
    async complete({ system, prompt, schema, signal }: AiRequest): Promise<string> {
      const session = await requestJson<{ id?: string }>('OpenCode', `${base}/session`, {
        body: { title: 'DevDrill' },
        headers,
        signal,
      });
      if (!session.id) throw new AiProviderError("OpenCode didn't create a session.");

      const answer = await requestJson<PromptResponse>(
        'OpenCode',
        `${base}/session/${encodeURIComponent(session.id)}/message`,
        {
          body: {
            ...(model ? { model } : {}),
            system,
            tools: TOOLS_OFF,
            parts: [{ type: 'text', text: prompt }],
            format: { type: 'json_schema', schema },
          },
          headers,
          signal,
        },
      );
      const error = answer.info?.error;
      if (error) {
        throw new AiProviderError(`OpenCode: ${error.data?.message ?? error.name ?? 'error'}`);
      }
      if (answer.info?.structured !== undefined) return JSON.stringify(answer.info.structured);
      const text = (answer.parts ?? [])
        .flatMap((p) => (p.type === 'text' && p.text ? [p.text] : []))
        .join('');
      if (!text) throw new AiProviderError('OpenCode sent an empty answer.');
      return text;
    },
  };
}
