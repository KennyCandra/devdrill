import { Lightbulb } from 'lucide-react';
import { useState } from 'react';
import Markdown from 'react-markdown';
import type { ChallengeDetail } from '@bughunt/shared';
import { Button } from './ui';

/** The challenge's README plus hints that are revealed one at a time. */
export function TaskPanel({ challenge }: { challenge: ChallengeDetail }) {
  const [shownHints, setShownHints] = useState(0);
  const { hints } = challenge;

  return (
    <aside className="flex h-full flex-col overflow-auto bg-side">
      <div className="px-3 pt-2 pb-2 text-[11px] font-semibold tracking-wide text-muted uppercase">
        Task
      </div>
      <div className="prose-task px-3 pb-4">
        <Markdown>{challenge.readme}</Markdown>
      </div>

      <div className="mt-auto flex flex-col gap-2 border-t border-line p-3">
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
          <Button onClick={() => setShownHints((n) => n + 1)} className="self-start">
            <Lightbulb size={14} aria-hidden="true" />
            Show hint {shownHints + 1} of {hints.length}
          </Button>
        )}
      </div>
    </aside>
  );
}
