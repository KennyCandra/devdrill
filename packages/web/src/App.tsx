import { createContext, useContext, useEffect, useState } from 'react';
import type { Settings } from '@bughunt/shared';
import { api, ApiRequestError } from './api/client';
import { Button, Spinner, StatusScreen } from './components/ui';
import { ChallengeList } from './pages/ChallengeList';
import { Workspace } from './pages/Workspace';
import { navigate, useRoute } from './router';
import { useTheme, type ResolvedTheme } from './theme';

type Session =
  | { state: 'loading' }
  | { state: 'ready'; settings: Settings }
  | { state: 'noToken' }
  | { state: 'badToken' }
  | { state: 'offline' };

const ThemeContext = createContext<ResolvedTheme>('dark');
export const useResolvedTheme = () => useContext(ThemeContext);

/** `hasToken` is read once at startup, in main.tsx. */
export function App({ hasToken }: { hasToken: boolean }) {
  const [session, setSession] = useState<Session>(
    hasToken ? { state: 'loading' } : { state: 'noToken' },
  );
  const route = useRoute();
  const theme = useTheme(session.state === 'ready' ? session.settings.theme : 'system');

  useEffect(() => {
    if (!hasToken) return;
    api
      .session()
      .then(() => api.settings())
      .then((settings) => setSession({ state: 'ready', settings }))
      .catch((err: unknown) =>
        setSession({
          state: err instanceof ApiRequestError && err.status === 401 ? 'badToken' : 'offline',
        }),
      );
  }, [hasToken]);

  switch (session.state) {
    case 'loading':
      return (
        <StatusScreen title="Connecting">
          <Spinner />
        </StatusScreen>
      );
    case 'noToken':
    case 'badToken':
      return (
        <StatusScreen title="Open the link from your terminal">
          For your safety, BugHunt only works through the link it prints when it starts (the one
          ending in <code className="font-mono">#token=…</code>). Copy it from the terminal, or run{' '}
          <code className="font-mono">npx bughunt</code> again.
        </StatusScreen>
      );
    case 'offline':
      return (
        <StatusScreen
          title="Can't reach the BugHunt server"
          action={<Button onClick={() => window.location.reload()}>Try again</Button>}
        >
          The server isn't running. Start it again with{' '}
          <code className="font-mono">npx bughunt</code>.
        </StatusScreen>
      );
    case 'ready':
      return (
        <ThemeContext.Provider value={theme}>
          {route.name === 'list' && <ChallengeList />}
          {route.name === 'workspace' && <Workspace key={route.id} id={route.id} />}
          {route.name === 'notFound' && (
            <StatusScreen
              title="Page not found"
              action={<Button onClick={() => navigate('/')}>All challenges</Button>}
            >
              That address doesn't match anything.
            </StatusScreen>
          )}
        </ThemeContext.Provider>
      );
  }
}
