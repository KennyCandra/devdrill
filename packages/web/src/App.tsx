import { Check, Copy } from 'lucide-react';
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
  | { state: 'noToken' }
  | { state: 'badToken' }
  | { state: 'offline' };

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
      .then((settings) => {
        setLanguage(settings.language);
        setSession({ state: 'ready', settings });
      })
      .catch((err: unknown) =>
        setSession({
          state: err instanceof ApiRequestError && err.status === 401 ? 'badToken' : 'offline',
        }),
      );
  }, [hasToken]);

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
    case 'noToken':
    case 'badToken':
      return (
        <StatusScreen
          title="Open the link from your terminal"
          action={<CommandBlock command={RUN_COMMAND} />}
        >
          For your safety, {PRODUCT_NAME} only works through the link it prints when it starts (the
          one ending in <code className="font-mono">#token=…</code>). Copy it from the terminal, or
          start {PRODUCT_NAME} again:
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

/** The run command in a small mono block, with a Copy button that says "Copied" for a moment. */
function CommandBlock({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
    } catch {
      // No clipboard here: the command is on screen, so it can be copied by hand.
    }
  };

  return (
    <div className="flex h-11 w-full max-w-[320px] items-center gap-3 rounded-lg border border-border-strong bg-editor pr-1.5 pl-4">
      <span aria-hidden="true" className="mono subtle text-[14px]">
        $
      </span>
      <code className="mono min-w-0 flex-1 truncate text-left text-[14px]">{command}</code>
      <Button variant="ghost" size="sm" onClick={() => void copy()}>
        {copied ? (
          <Check className="i i-sm" aria-hidden="true" />
        ) : (
          <Copy className="i i-sm" aria-hidden="true" />
        )}
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
}
