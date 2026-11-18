import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setToken } from './api/client';
import { App } from './App';

const SETTINGS = { timerEnabled: true, theme: 'system', language: 'js' };

/** Answers the API the way the server does; `status` is what /api/session returns. */
function stubApi(status = 200) {
  const fetchMock = vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.endsWith('/api/session')) {
      return Promise.resolve(
        status === 200
          ? Response.json({ ok: true, appName: 'DevDrill' })
          : Response.json({ error: 'Missing or wrong access token.' }, { status }),
      );
    }
    if (url.endsWith('/api/settings')) return Promise.resolve(Response.json(SETTINGS));
    return Promise.resolve(Response.json([]));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  cleanup();
  setToken(null);
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('App startup', () => {
  it('loads straight away locally, with no token screen and no token header', async () => {
    const fetchMock = stubApi();
    render(<App />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/settings', expect.anything()));
    await waitFor(() => expect(screen.queryByText('Connecting')).toBeNull());
    expect(screen.queryByText('Open the full link')).toBeNull();
    expect(screen.queryByText(/start it with/)).toBeNull();

    for (const [, init] of fetchMock.mock.calls) {
      expect((init?.headers ?? {}) as Record<string, string>).not.toHaveProperty(
        'x-devdrill-token',
      );
    }
  });

  it('asks for the full link when the server answers 401 (hosted, no or wrong token)', async () => {
    stubApi(401);
    render(<App />);

    expect(await screen.findByText('Open the full link')).toBeTruthy();
    expect(screen.queryByText('Open the link from your terminal')).toBeNull();
  });
});
