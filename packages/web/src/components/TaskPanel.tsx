import { Lightbulb } from 'lucide-react';
import { useState } from 'react';
import Markdown, { type Components } from 'react-markdown';
import type { ChallengeDetail } from '@bughunt/shared';
import { Button } from './ui';

// Links leave the app in a new tab, so leaving never drops unsaved work.
const markdownComponents: Components = {
  a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
};

const hintsKey = (id: string) => `bughunt-hints-${id}`;

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
