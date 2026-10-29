import { Bot, Bug, GitPullRequest, Lightbulb, Sparkles } from 'lucide-react';
import { useState } from 'react';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChallengeDetail } from '@devdrill/shared';
import { Button, Spinner } from './ui';

// Links leave the app in a new tab, so leaving never drops unsaved work.
const markdownComponents: Components = {
  a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
  // Tables and code keep their shape and scroll sideways in a narrow panel,
  // instead of squeezing and reflowing as the panel is resized.
  table: ({ node: _node, ...props }) => (
    <div className="prose-scroll">
      <table {...props} />
    </div>
  ),
};

// GitHub-flavored Markdown: the "Data" sections are tables.
const remarkPlugins = [remarkGfm];

const hintsKey = (id: string) => `devdrill-hints-${id}`;

function readShownHints(id: string): number {
  try {
    return Number(localStorage.getItem(hintsKey(id))) || 0;
  } catch {
    return 0;
  }
}

/**
 * The challenge's README, with hints revealed one at a time pinned underneath. With an AI
 * provider set up (`askAi`), the AI can add a hint based on the player's code.
 */
export function TaskPanel({
  challenge,
  askAi,
}: {
  challenge: ChallengeDetail;
  /** Gets an AI hint, given the written hints already shown. */
  askAi?: (shownHints: string[]) => Promise<string>;
}) {
  const { id, hints } = challenge;
  const [shownHints, setShownHints] = useState(() => Math.min(readShownHints(id), hints.length));
  const [aiHints, setAiHints] = useState<string[]>([]);
  const [asking, setAsking] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const askForHint = async () => {
    if (!askAi) return;
    setAsking(true);
    setAiError(null);
    try {
      const hint = await askAi(hints.slice(0, shownHints));
      setAiHints((prev) => [...prev, hint]);
    } catch (err) {
      setAiError((err as Error).message);
    } finally {
      setAsking(false);
    }
  };

  const showNext = () => {
    const next = shownHints + 1;
    setShownHints(next);
    try {
      localStorage.setItem(hintsKey(id), String(next));
    } catch {
      // Storage unavailable: the hint still shows for this visit.
    }
  };

  return (
    <aside className="flex h-full flex-col bg-side">
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="px-3 pt-2 pb-2 text-[11px] font-semibold tracking-wide text-muted uppercase">
          Task
        </div>
        <ModeNote mode={challenge.mode} />
        <div className="prose-task px-3 pb-4">
          <Markdown remarkPlugins={remarkPlugins} components={markdownComponents}>
            {challenge.readme}
          </Markdown>
        </div>
      </div>

      <div className="flex max-h-[45%] shrink-0 flex-col gap-2 overflow-auto border-t border-line p-3">
        {hints.slice(0, shownHints).map((hint, i) => (
          <p key={i} className="animate-fade-in flex gap-2 rounded bg-hover p-2 leading-relaxed">
            <Lightbulb size={14} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
            <span>
              <span className="text-muted">Hint {i + 1}: </span>
              {hint}
            </span>
          </p>
        ))}
        {aiHints.map((hint, i) => (
          <p
            key={`ai-${i}`}
            className="animate-fade-in flex gap-2 rounded bg-hover p-2 leading-relaxed"
          >
            <Bot size={14} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
            <span>
              <span className="text-muted">AI hint: </span>
              {hint}
            </span>
          </p>
        ))}
        {aiError && (
          <p role="alert" className="text-danger">
            {aiError}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {shownHints < hints.length && (
            <Button onClick={showNext} className="self-start">
              <Lightbulb size={14} aria-hidden="true" />
              {shownHints === 0
                ? 'Need a hint?'
                : `Next hint (${shownHints + 1} of ${hints.length})`}
            </Button>
          )}
          {askAi && (
            <Button onClick={() => void askForHint()} disabled={asking} className="self-start">
              {asking ? <Spinner /> : <Bot size={14} aria-hidden="true" />}
              {asking ? 'Thinking…' : 'Ask AI for a hint'}
            </Button>
          )}
        </div>
      </div>
    </aside>
  );
}

/** What "done" means in each mode, since they work differently. */
function ModeNote({ mode }: { mode: ChallengeDetail['mode'] }) {
  const debug = mode === 'debug';
  const Icon = debug ? Bug : mode === 'review' ? GitPullRequest : Sparkles;
  return (
    <p className="mx-3 mb-3 flex gap-2 rounded border border-line p-2 leading-relaxed">
      <Icon size={14} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
      <span>
        {mode === 'review' ? (
          <>
            <strong className="font-semibold">Review a pull request.</strong> Comment on what's
            wrong, then approve it or request changes. Comments that point at nothing real count
            against you.
          </>
        ) : debug ? (
          <>
            <strong className="font-semibold">Debug.</strong> Something is broken. Find the cause
            and fix it so every test passes.
          </>
        ) : (
          <>
            <strong className="font-semibold">Add a feature.</strong> The existing tests pass now
            and must keep passing. Hidden tests check your new feature when you submit.
          </>
        )}
      </span>
    </p>
  );
}
