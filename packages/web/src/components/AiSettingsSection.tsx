import { CircleCheck, CircleX, KeyRound, PlugZap } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { AiProviderId, AiSettings, AiTestResult } from '@devdrill/shared';
import { api } from '../api/client';
import { Dropdown } from './Dropdown';
import { Button, Spinner } from './ui';

type Choice = AiProviderId | 'off';

/**
 * Settings → AI: which provider the AI features use, and its model, URL and key.
 * The key field never shows a saved key (the server doesn't send it back); typing a new
 * one replaces it.
 */
export function AiSettingsSection() {
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [choice, setChoice] = useState<Choice>('off');
  const [model, setModel] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState<'save' | 'test' | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const modelId = useId();
  const urlId = useId();
  const keyId = useId();
  // What was typed for other providers, so looking at another one doesn't lose it.
  const drafts = useRef<
    Partial<Record<AiProviderId, { model: string; baseUrl: string; apiKey: string }>>
  >({});

  // Fills the form from the saved settings of one provider.
  const show = (next: AiSettings, provider: Choice) => {
    setSettings(next);
    setChoice(provider);
    setApiKey('');
    if (provider !== 'off') {
      setModel(next.providers[provider].model);
      setBaseUrl(next.providers[provider].baseUrl ?? '');
    }
  };

  useEffect(() => {
    let cancelled = false;
    api
      .aiSettings()
      .then((s) => !cancelled && show(s, s.active ?? 'off'))
      .catch((err: Error) => !cancelled && setLoadError(err.message));
    return () => {
      cancelled = true;
    };
  }, []);

  if (loadError) return <p className="text-danger">Couldn't load the AI settings: {loadError}</p>;
  if (!settings) return <Spinner className="text-muted" />;

  const info = choice === 'off' ? null : settings.available.find((p) => p.id === choice);
  const saved = choice === 'off' ? null : settings.providers[choice];
  const isActive = settings.active === (choice === 'off' ? null : choice);
  const dirty =
    !isActive ||
    (saved !== null && (model !== saved.model || baseUrl !== (saved.baseUrl ?? ''))) ||
    apiKey !== '';

  const save = async (): Promise<AiSettings | null> => {
    setBusy('save');
    setMessage(null);
    try {
      const next = await api.saveAiSettings(
        choice === 'off'
          ? { active: null }
          : {
              active: choice,
              provider: choice,
              model: model.trim(),
              ...(info?.needsBaseUrl ? { baseUrl: baseUrl.trim() || null } : {}),
              ...(apiKey ? { apiKey } : {}),
            },
      );
      const switched = choice !== 'off' && settings?.active !== choice;
      if (choice !== 'off') delete drafts.current[choice];
      show(next, choice);
      setMessage({
        ok: true,
        text:
          choice === 'off'
            ? 'AI is off.'
            : switched
              ? `Saved. The AI now uses ${info?.label ?? choice}.`
              : 'Saved.',
      });
      return next;
    } catch (err) {
      setMessage({ ok: false, text: (err as Error).message });
      return null;
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    if (choice === 'off') return;
    // Test what's on screen: save first if it changed (that also makes it the active one).
    if (dirty && !(await save())) return;
    setBusy('test');
    setMessage(null);
    try {
      const result: AiTestResult = await api.testAi(choice);
      setMessage({
        ok: result.ok,
        text: `${result.message} (${(result.durationMs / 1000).toFixed(1)}s)`,
      });
    } catch (err) {
      setMessage({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const removeKey = async () => {
    if (choice === 'off') return;
    setBusy('save');
    try {
      const next = await api.saveAiSettings({ provider: choice, apiKey: null });
      // Keep what's typed in the other fields; only the key goes.
      setSettings(next);
      setApiKey('');
      setMessage({ ok: true, text: 'Key removed.' });
    } catch (err) {
      setMessage({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted">
        Optional. With a provider, the AI can judge your review comments and give feedback on your
        solutions. It never decides pass or fail. What you send goes to the provider you pick; with
        Ollama it stays on your machine.
      </p>

      <Dropdown<Choice>
        label="AI provider"
        value={choice}
        options={[
          { value: 'off', label: 'Off' },
          ...settings.available.map((p) => ({ value: p.id, label: p.label })),
        ]}
        onChange={(next) => {
          setMessage(null);
          if (choice !== 'off') drafts.current[choice] = { model, baseUrl, apiKey };
          show(settings, next);
          const draft = next === 'off' ? undefined : drafts.current[next];
          if (draft) {
            setModel(draft.model);
            setBaseUrl(draft.baseUrl);
            setApiKey(draft.apiKey);
          }
        }}
      />

      {info && saved && (
        <div className="flex flex-col gap-3 rounded border border-line p-3">
          <p className="text-muted">{info.description}</p>

          <label htmlFor={modelId} className="flex flex-col gap-1">
            <span className="text-[12px] text-muted">Model</span>
            <input
              id={modelId}
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={info.defaultModel}
              spellCheck={false}
              className="h-8 rounded border border-line-strong bg-bg px-2 font-mono text-[12px] focus-visible:outline-2 focus-visible:outline-accent"
            />
          </label>

          {info.needsBaseUrl && (
            <label htmlFor={urlId} className="flex flex-col gap-1">
              <span className="text-[12px] text-muted">Server URL</span>
              <input
                id={urlId}
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder={info.defaultBaseUrl ?? 'https://…'}
                spellCheck={false}
                className="h-8 rounded border border-line-strong bg-bg px-2 font-mono text-[12px] focus-visible:outline-2 focus-visible:outline-accent"
              />
            </label>
          )}

          {info.needsBaseUrl && saved.hasKey && !apiKey && baseUrl !== (saved.baseUrl ?? '') && (
            <p className="text-[12px] text-warning">
              Saving a different URL removes the saved key, so it's never sent to a server it wasn't
              meant for. Enter the key again if this server needs it.
            </p>
          )}

          <label htmlFor={keyId} className="flex flex-col gap-1">
            <span className="text-[12px] text-muted">
              {info.needsKey
                ? 'API key'
                : info.id === 'opencode'
                  ? 'Server password (only if you set one)'
                  : 'API key (only if the server needs one)'}
            </span>
            <input
              id={keyId}
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={saved.hasKey ? 'Saved. Type a new one to replace it.' : ''}
              spellCheck={false}
              className="h-8 rounded border border-line-strong bg-bg px-2 font-mono text-[12px] focus-visible:outline-2 focus-visible:outline-accent"
            />
          </label>
          {saved.hasKey && (
            <p className="flex items-center gap-2 text-[12px] text-muted">
              <KeyRound size={13} aria-hidden="true" /> A key is saved on this computer.
              <button
                type="button"
                onClick={() => void removeKey()}
                className="underline underline-offset-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-accent"
              >
                Remove it
              </button>
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={() => void save()} disabled={busy !== null || !dirty}>
          {busy === 'save' ? <Spinner /> : null} Save
        </Button>
        {choice !== 'off' && (
          <Button onClick={() => void test()} disabled={busy !== null}>
            {busy === 'test' ? <Spinner /> : <PlugZap size={14} aria-hidden="true" />} Test
            connection
          </Button>
        )}
        {message && (
          <span
            role={message.ok ? 'status' : 'alert'}
            className={`flex items-center gap-1.5 ${message.ok ? 'text-success' : 'text-danger'}`}
          >
            {message.ok ? (
              <CircleCheck size={14} aria-hidden="true" />
            ) : (
              <CircleX size={14} aria-hidden="true" />
            )}
            {message.text}
          </span>
        )}
      </div>
    </div>
  );
}
