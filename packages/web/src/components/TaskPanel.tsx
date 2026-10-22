import { Bug, Lightbulb, Sparkles } from 'lucide-react';
import { useState } from 'react';
import Markdown, { type Components } from 'react-markdown';
import type { ChallengeDetail } from '@devdrill/shared';
import { Button } from './ui';

// Links leave the app in a new tab, so leaving never drops unsaved work.
const markdownComponents: Components = {
  a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
};

const hintsKey = (id: string) => `devdrill-hints-${id}`;

function readShownHints(id: string): number {
  try {
    return Number(localStorage.getItem(hintsKey(id))) || 0;
  } catch {
    return 0;
  }
}

/** The challenge's README, with hints revealed one at a time pinned underneath. */
export function TaskPanel({ challenge }: { challenge: ChallengeDetail }) {
  const { id, hints } = challenge;
  const [shownHints, setShownHints] = useState(() => Math.min(readShownHints(id), hints.length));

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
          <Markdown components={markdownComponents}>{challenge.readme}</Markdown>
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
        {shownHints < hints.length && (
          <Button onClick={showNext} className="self-start">
            <Lightbulb size={14} aria-hidden="true" />
            {shownHints === 0 ? 'Need a hint?' : `Next hint (${shownHints + 1} of ${hints.length})`}
          </Button>
        )}
      </div>
    </aside>
  );
}

/** What "done" means in each mode, since the two work differently. */
function ModeNote({ mode }: { mode: ChallengeDetail['mode'] }) {
  const debug = mode === 'debug';
  const Icon = debug ? Bug : Sparkles;
  return (
    <p className="mx-3 mb-3 flex gap-2 rounded border border-line p-2 leading-relaxed">
      <Icon size={14} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
      <span>
        {debug ? (
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
