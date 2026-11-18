import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, setToken } from './client';

const TOKEN_HEADER = 'x-devdrill-token';

/** Stubs fetch with a JSON answer, and returns the mock so tests can read what was sent. */
function stubFetch(status = 200) {
  const fetchMock = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) =>
    Promise.resolve(
      new Response(JSON.stringify({ ok: true, appName: 'DevDrill' }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function sentHeaders(fetchMock: ReturnType<typeof stubFetch>): Record<string, string> {
  return (fetchMock.mock.calls[0]?.[1]?.headers ?? {}) as Record<string, string>;
}

afterEach(() => {
  setToken(null);
  vi.unstubAllGlobals();
});

describe('access token header', () => {
  it('sends no token header locally, where there is no token', async () => {
    const fetchMock = stubFetch();
    setToken(null);
    await api.session();
    expect(sentHeaders(fetchMock)).not.toHaveProperty(TOKEN_HEADER);
  });

  it('sends the hosted token once there is one', async () => {
    const fetchMock = stubFetch();
    setToken('a-hosted-token-0123456789');
    await api.session();
    expect(sentHeaders(fetchMock)).toMatchObject({ [TOKEN_HEADER]: 'a-hosted-token-0123456789' });
  });

  it('sends no token header on a write either, when there is none', async () => {
    const fetchMock = stubFetch();
    setToken(null);
    await api.saveAiSettings({ provider: 'ollama' });
    expect(sentHeaders(fetchMock)).not.toHaveProperty(TOKEN_HEADER);
  });
});
