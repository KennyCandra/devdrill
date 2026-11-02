import { Check, CircleCheck, CircleX, KeyRound, PlugZap, TriangleAlert } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { AiProviderId, AiSettings, AiTestResult } from '@devdrill/shared';
import { api } from '../api/client';
import { Button, Spinner } from './ui';

type Choice = AiProviderId | 'off';

/** The short line each provider card shows. The detail form shows the server's fuller description. */
const CARD_SUMMARY: Partial<Record<AiProviderId, string>> = {
  claude: 'Anthropic API key',
  openai: 'OpenAI API key',
  ollama: 'Runs on your own Ollama server',
  opencode: 'A local OpenCode server',
  custom: 'Any OpenAI-compatible API',
};

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
  const groupName = useId();
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
  if (!settings) return <Spinner className="subtle" />;

  const info = choice === 'off' ? null : settings.available.find((p) => p.id === choice);
  const saved = choice === 'off' ? null : settings.providers[choice];
  const isActive = settings.active === (choice === 'off' ? null : choice);
  const dirty =
    !isActive ||
    (saved !== null && (model !== saved.model || baseUrl !== (saved.baseUrl ?? ''))) ||
    apiKey !== '';

  // Off first, then every provider the server offers, in its order.
  const cards: { id: Choice; label: string; summary?: string }[] = [
    { id: 'off', label: 'Off', summary: 'No AI. Everything else works.' },
    ...settings.available.map((p) => ({ id: p.id, label: p.label, summary: CARD_SUMMARY[p.id] })),
  ];

  // Picking a card: what was typed for the provider you leave is kept as a draft.
  const choose = (next: Choice) => {
    setMessage(null);
    if (choice !== 'off') drafts.current[choice] = { model, baseUrl, apiKey };
    show(settings, next);
    const draft = next === 'off' ? undefined : drafts.current[next];
    if (draft) {
      setModel(draft.model);
      setBaseUrl(draft.baseUrl);
      setApiKey(draft.apiKey);
    }
  };

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
    <div className="flex flex-col gap-5">
      <p className="muted text-[14px] leading-[21px]">
        Optional. With a provider, the AI can give hints, judge your review comments and give
        feedback on your solutions. It never decides pass or fail. What you send goes to the
        provider you pick; a local Ollama server keeps it on your machine.
      </p>

      <fieldset className="flex min-w-0 flex-col">
        <legend className="mb-2 text-[13px] font-medium">AI provider</legend>
        <div className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,170px),1fr))]">
          {cards.map((card) => {
            const selected = choice === card.id;
            return (
              <label
                key={card.id}
                className={`flex cursor-pointer flex-col gap-0.5 rounded-lg border p-3 transition-colors duration-100 has-focus-visible:outline-2 has-focus-visible:outline-accent ${
                  selected
                    ? 'border-accent bg-accent-soft shadow-[0_0_0_1px_var(--accent)]'
                    : 'border-border-strong bg-surface hover:bg-surface-hover'
                }`}
              >
                <input
                  type="radio"
                  name={groupName}
                  value={card.id}
                  checked={selected}
                  onChange={() => choose(card.id)}
                  className="sr-only"
                />
                <span className="flex items-center justify-between gap-2 text-[14px] font-semibold">
                  {card.label}
                  {selected && <Check className="i i-sm text-accent" aria-hidden="true" />}
                </span>
                {card.summary && (
                  <span className="muted text-[12px] leading-4">{card.summary}</span>
                )}
              </label>
            );
          })}
        </div>
      </fieldset>

      {info && saved && (
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface-2 p-4">
          <p className="muted text-[14px] leading-[21px]">{info.description}</p>

          <div>
            <label htmlFor={modelId} className="field-label">
              Model
            </label>
            <input
              id={modelId}
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={info.defaultModel}
              spellCheck={false}
              className="input mono"
            />
          </div>

          {info.needsBaseUrl && (
            <div>
              <label htmlFor={urlId} className="field-label">
                Server URL
              </label>
              <input
                id={urlId}
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder={info.defaultBaseUrl ?? 'https://…'}
                spellCheck={false}
                className="input mono"
              />
            </div>
          )}

          {info.needsBaseUrl && saved.hasKey && !apiKey && baseUrl !== (saved.baseUrl ?? '') && (
            <p className="flex items-start gap-2 rounded-md bg-warning-bg px-2.5 py-2 text-[13px] leading-[19px] text-warning">
              <TriangleAlert className="i i-sm mt-0.5" aria-hidden="true" />
              <span>
                Saving a different URL removes the saved key, so it's never sent to a server it
                wasn't meant for. Enter the key again if this server needs it.
              </span>
            </p>
          )}

          <div>
            <label htmlFor={keyId} className="field-label">
              {info.needsKey
                ? 'API key'
                : info.id === 'opencode'
                  ? 'Server password (only if you set one)'
                  : 'API key (only if the server needs one)'}
            </label>
            <input
              id={keyId}
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={saved.hasKey ? 'Saved. Type a new one to replace it.' : ''}
              spellCheck={false}
              className="input mono"
            />
          </div>
          {saved.hasKey && (
            <p className="flex flex-wrap items-center gap-2 text-[13px] text-fg-2">
              <KeyRound className="i i-sm" aria-hidden="true" /> A key is saved on this computer.
              <button type="button" onClick={() => void removeKey()} className="link">
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
            className={`flex items-center gap-1.5 text-[13px] ${message.ok ? 'text-success' : 'text-danger'}`}
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
