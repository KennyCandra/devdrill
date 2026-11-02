import { Bot, ChevronLeft, Lightbulb } from 'lucide-react';
import { useState, type Ref } from 'react';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChallengeDetail, ChallengeMode } from '@devdrill/shared';
import { Button, MODE_ICONS, Spinner } from './ui';

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
  onCollapse,
  collapseRef,
  title = 'Task',
}: {
  challenge: ChallengeDetail;
  /** Gets an AI hint, given the written hints already shown. */
  askAi?: (shownHints: string[]) => Promise<string>;
  /** Shows a collapse button in the header when the panel can be folded away. */
  onCollapse?: () => void;
  /** Lets the page move focus to the collapse button. */
  collapseRef?: Ref<HTMLButtonElement>;
  /** The panel's name in its header: "Task", or "Pull request" in a review. */
  title?: string;
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
    <aside className="panel flex h-full flex-col">
      <div className="panel-header">
        <span className="panel-title">{title}</span>
        {onCollapse && (
          <button
            ref={collapseRef}
            type="button"
            onClick={onCollapse}
            aria-label={`Collapse ${title.toLowerCase()} panel`}
            title={`Collapse ${title.toLowerCase()} panel`}
            className="btn btn-ghost btn-icon btn-sm"
          >
            <ChevronLeft className="i i-sm" aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="flex flex-col gap-4 px-5 pt-4 pb-5">
          <ModeNote mode={challenge.mode} />
          <div className="prose-task">
            <Markdown remarkPlugins={remarkPlugins} components={markdownComponents}>
              {challenge.readme}
            </Markdown>
          </div>
        </div>
      </div>

      <section
        aria-label="Hints"
        className="flex max-h-[45%] shrink-0 flex-col gap-2 overflow-auto border-t border-line px-5 py-3"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="panel-title">Hints</span>
          <span className="mono subtle text-[12px]">
            {shownHints} of {hints.length} shown
          </span>
        </div>
        {hints.slice(0, shownHints).map((hint, i) => (
          <p
            key={i}
            className="animate-fade-in flex gap-2.5 rounded-md border border-line bg-surface-2 px-3 py-2.5 text-[14px] leading-[21px]"
          >
            <span
              className="mono w-3.5 shrink-0 pt-0.5 text-[12px] text-warning"
              aria-hidden="true"
            >
              {i + 1}
            </span>
            <span>
              <span className="sr-only">Hint {i + 1}: </span>
              {hint}
            </span>
          </p>
        ))}
        <div aria-live="polite" className="contents">
          {aiHints.map((hint, i) => (
            <div
              key={`ai-${i}`}
              className="animate-fade-in flex flex-col gap-1 rounded-md border border-line bg-surface-2 px-3 py-2.5"
            >
              <span className="flex items-center gap-1.5 text-[12px] font-medium text-accent">
                <Bot className="i i-sm" aria-hidden="true" />
                AI hint
              </span>
              <p className="text-[14px] leading-[21px]">{hint}</p>
            </div>
          ))}
        </div>
        {aiError && (
          <p role="alert" className="text-[13px] text-danger">
            {aiError}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {shownHints < hints.length && (
            <Button size="sm" onClick={showNext}>
              <Lightbulb className="i i-sm" aria-hidden="true" />
              {shownHints === 0
                ? 'Need a hint?'
                : `Next hint · ${shownHints + 1} of ${hints.length}`}
            </Button>
          )}
          {askAi && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void askForHint()}
              disabled={asking}
              className="text-accent"
            >
              {asking ? <Spinner /> : <Bot className="i i-sm" aria-hidden="true" />}
              {asking ? 'Thinking…' : 'Ask AI for a hint'}
            </Button>
          )}
        </div>
      </section>
    </aside>
  );
}

const MODE_NOTES: Record<ChallengeMode, { lead: string; body: string; detail: string }> = {
  debug: {
    lead: 'Debug.',
    body: 'Something is broken. Find the cause and fix it.',
    detail: 'Done means every visible and hidden test passes.',
  },
  feature: {
    lead: 'Add a feature.',
    body: 'The existing tests pass now and must keep passing.',
    detail: 'Hidden tests check your new feature when you submit.',
  },
  review: {
    lead: 'Review a pull request.',
    body: "Comment on what's wrong, then approve it or request changes.",
    detail: 'Your verdict is checked, then you tick what you caught.',
  },
};

/** What "done" means in each mode, since they work differently. Tinted in the mode's colour. */
function ModeNote({ mode }: { mode: ChallengeMode }) {
  const Icon = MODE_ICONS[mode];
  const note = MODE_NOTES[mode];
  return (
    <div
      className="flex gap-2.5 rounded-lg px-3.5 py-3 text-[14px] leading-[21px]"
      style={{ background: `var(--mode-${mode}-bg)` }}
    >
      <Icon className="i mt-0.5" aria-hidden="true" style={{ color: `var(--mode-${mode})` }} />
      <div className="flex flex-col gap-1">
        <p>
          <strong className="font-semibold">{note.lead}</strong> {note.body}
        </p>
        <p className="muted">{note.detail}</p>
      </div>
    </div>
  );
}
