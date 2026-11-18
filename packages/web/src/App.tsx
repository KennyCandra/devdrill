import { useCallback, useEffect, useRef, useState } from 'react';
import type { Settings } from '@devdrill/shared';
import { api, ApiRequestError, setLanguage } from './api/client';
import { Button, Spinner, StatusScreen } from './components/ui';
import { ChallengeList } from './pages/ChallengeList';
import { Results } from './pages/Results';
import { SettingsPage } from './pages/SettingsPage';
import { Workspace } from './pages/Workspace';
import { ReviewResults } from './pages/ReviewResults';
import { ReviewWorkspace } from './pages/ReviewWorkspace';
import { navigate, useRoute } from './router';
import { SettingsProvider } from './settings';
import { ThemeProvider, useTheme } from './theme';
import { PRODUCT_NAME, RUN_COMMAND } from './brand';

type Session =
  | { state: 'loading' }
  | { state: 'ready'; settings: Settings }
  /** Hosted mode only: the server wants the full link with its access token. */
  | { state: 'unauthorized' }
  | { state: 'offline' };

export function App() {
  const [session, setSession] = useState<Session>({ state: 'loading' });
  const route = useRoute();
  const theme = useTheme(session.state === 'ready' ? session.settings.theme : 'system');

  useEffect(() => {
    api
      .session()
      .then(() => api.settings())
      .then((settings) => {
        setLanguage(settings.language);
        setSession({ state: 'ready', settings });
      })
      .catch((err: unknown) =>
        setSession({
          state: err instanceof ApiRequestError && err.status === 401 ? 'unauthorized' : 'offline',
        }),
      );
  }, []);

  // Two quick changes can answer out of order; only the latest request's answer counts.
  const latestUpdate = useRef(0);
  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    const request = ++latestUpdate.current;
    const saved = await api.saveSettings(patch);
    if (request === latestUpdate.current) {
      setLanguage(saved.language);
      setSession({ state: 'ready', settings: saved });
    }
  }, []);

  switch (session.state) {
    case 'loading':
      return (
        <StatusScreen title="Connecting">
          <Spinner />
        </StatusScreen>
      );
    case 'unauthorized':
      return (
        <StatusScreen title="Open the full link">
          This address is missing its access token, or the token is wrong. Open the full link you
          were given, the one ending in <code className="font-mono">#token=…</code>. If you run{' '}
          {PRODUCT_NAME} on your own computer, start it with{' '}
          <code className="font-mono">{RUN_COMMAND}</code> instead.
        </StatusScreen>
      );
    case 'offline':
      return (
        <StatusScreen
          title={`Can't reach the ${PRODUCT_NAME} server`}
          action={<Button onClick={() => window.location.reload()}>Try again</Button>}
        >
          The server isn't running. Start it again with{' '}
          <code className="font-mono">{RUN_COMMAND}</code>.
        </StatusScreen>
      );
    case 'ready':
      return (
        <SettingsProvider value={{ settings: session.settings, update: updateSettings }}>
          <ThemeProvider value={theme}>
            {route.name === 'list' && <ChallengeList key={session.settings.language} />}
            {route.name === 'settings' && <SettingsPage />}
            {/* Keyed by language too: switching languages loads a different workspace. */}
            {route.name === 'results' && route.id.startsWith('review-') && (
              <ReviewResults
                key={`${session.settings.language}:${route.id}`}
                id={route.id}
                lang={session.settings.language}
              />
            )}
            {route.name === 'results' && !route.id.startsWith('review-') && (
              <Results
                key={`${session.settings.language}:${route.id}`}
                id={route.id}
                lang={session.settings.language}
              />
            )}
            {route.name === 'workspace' && route.id.startsWith('review-') && (
              <ReviewWorkspace
                key={`${session.settings.language}:${route.id}`}
                id={route.id}
                lang={session.settings.language}
              />
            )}
            {route.name === 'workspace' && !route.id.startsWith('review-') && (
              <Workspace
                key={`${session.settings.language}:${route.id}`}
                id={route.id}
                lang={session.settings.language}
              />
            )}
            {route.name === 'notFound' && (
              <StatusScreen
                title="Page not found"
                action={<Button onClick={() => navigate('/')}>All challenges</Button>}
              >
                That address doesn't match anything.
              </StatusScreen>
            )}
          </ThemeProvider>
        </SettingsProvider>
      );
  }
}
