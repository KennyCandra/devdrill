import { AiProviderError } from '../provider.js';

/**
 * A JSON request to a provider's HTTP API (Ollama, OpenCode). Turns network failures and
 * error statuses into messages for the player.
 */
export async function requestJson<T>(
  name: string,
  url: string,
  init: { method?: string; body?: unknown; headers?: Record<string, string>; signal: AbortSignal },
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
      headers: {
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
      signal: init.signal,
    });
  } catch (err) {
    if (init.signal.aborted) throw err;
    throw new AiProviderError(`Couldn't reach ${name} at ${new URL(url).origin}. Is it running?`);
  }
  if (res.status === 401 || res.status === 403) {
    throw new AiProviderError(`${name} refused the request: check the password or key.`);
  }
  if (res.status === 404) {
    throw new AiProviderError(`${name} answered "not found": check the URL and the model name.`);
  }
  if (!res.ok) {
    throw new AiProviderError(`${name} answered with an error (${res.status}).`);
  }
  try {
    return (await res.json()) as T;
  } catch {
    throw new AiProviderError(`${name} sent something that isn't JSON. Is the URL right?`);
  }
}
