import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  CircleDot,
  Search,
  Terminal,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import type {
  ChallengeMode,
  ChallengeStatus,
  ChallengeSummary,
  Difficulty,
} from '@devdrill/shared';
import { api } from '../api/client';
import { TopBar } from '../components/TopBar';
import { Dropdown } from '../components/Dropdown';
import { LanguageSwitch } from '../components/LanguageSwitch';
import { useSettings } from '../settings';
import {
  Button,
  DifficultyBadge,
  Kbd,
  MODE_ICONS,
  MODE_NAMES,
  ModeBadge,
  modKey,
  Spinner,
} from '../components/ui';
import { challengePath, navigate } from '../router';
import { formatDuration } from '../workspace/timer';

type ModeFilter = 'all' | ChallengeMode;

/** The mode cards: "All", then one per mode, each with a line on what the mode asks. */
const MODE_CARDS: { value: ModeFilter; description: string }[] = [
  { value: 'all', description: 'Every mode, in suggested order.' },
  { value: 'debug', description: "Find and fix a bug in code you didn't write." },
  { value: 'feature', description: 'Add to working code without breaking it.' },
  { value: 'review', description: 'Read a pull request and make the call.' },
];

const DIFFICULTY_OPTIONS: { value: Difficulty | 'all'; label: string }[] = [
  { value: 'all', label: 'Any difficulty' },
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

const STATUS_OPTIONS: { value: ChallengeStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Any status' },
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'solved', label: 'Solved' },
];

const STATUS_LABEL: Record<ChallengeStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  solved: 'Solved',
};

/** The columns of the challenge list. The header and every row share them. */
const ROW_COLUMNS = 'grid-cols-[52px_28px_minmax(0,1fr)_112px_104px_64px_72px]';

/** How to work each mode, one card per mode in the How it works section. */
const HOW_IT_WORKS: { mode: ChallengeMode; steps: ReactNode[] }[] = [
  {
    mode: 'debug',
    steps: [
      "Read the bug report. The code isn't yours.",
      <>
        Find the cause. Run the visible tests as often as you like with <Kbd>{modKey} Enter</Kbd>.
      </>,
      'Submit. Hidden tests check the edge cases; then compare with the reference fix.',
    ],
  },
  {
    mode: 'feature',
    steps: [
      'Read the ticket and the code around it.',
      'Build it. The existing tests must keep passing.',
      'Submit. Hidden tests check what the ticket promised.',
    ],
  },
  {
    mode: 'review',
    steps: [
      'Read the pull request and its diff.',
      'Comment on the lines that matter, then approve or request changes.',
      'Submit, compare with the answer key and tick what you caught.',
    ],
  },
];

export function ChallengeList() {
  const [challenges, setChallenges] = useState<ChallengeSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ModeFilter>('all');
  const [difficulty, setDifficulty] = useState<Difficulty | 'all'>('all');
  const [status, setStatus] = useState<ChallengeStatus | 'all'>('all');
  const [query, setQuery] = useState('');
  // Null until the player toggles it; then the default below applies.
  const [howOpenChoice, setHowOpenChoice] = useState<boolean | null>(null);

  const { settings } = useSettings();

  useEffect(() => {
    api
      .challenges()
      // Only challenges that exist in the chosen language.
      .then((all) => setChallenges(all.filter((c) => c.languages.includes(settings.language))))
      .catch((err: Error) => setError(err.message));
  }, [settings.language]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (challenges ?? []).filter(
      (c) =>
        (mode === 'all' || c.mode === mode) &&
        (difficulty === 'all' || c.difficulty === difficulty) &&
        (status === 'all' || c.progress.status === status) &&
        (q === '' ||
          c.title.toLowerCase().includes(q) ||
          c.tags.some((t) => t.toLowerCase().includes(q))),
    );
  }, [challenges, mode, difficulty, status, query]);

  // Each challenge's place in the full list, so its number stays put when filters change.
  const positions = useMemo(
    () => new Map((challenges ?? []).map((c, i) => [c.id, i + 1] as const)),
    [challenges],
  );

  const solved = challenges?.filter((c) => c.progress.status === 'solved').length ?? 0;
  // Pick up where you left off, else the first one you haven't tried.
  const next =
    challenges?.find((c) => c.progress.status === 'in_progress') ??
    challenges?.find((c) => c.progress.status === 'not_started');
  // Anyone who has started a challenge is returning: a compact page, How it works closed.
  const returning = challenges?.some((c) => c.progress.status !== 'not_started') ?? false;
  const howOpen = howOpenChoice ?? !returning;

  const clearFilters = () => {
    setMode('all');
    setDifficulty('all');
    setStatus('all');
    setQuery('');
  };

  return (
    <div className="flex h-full flex-col">
      <TopBar right={<LanguageSwitch />} />

      <main
        className={`mx-auto flex w-full max-w-[1120px] flex-1 flex-col overflow-auto px-6 pb-18 ${
          returning ? 'gap-6 pt-8' : 'gap-10 pt-12'
        }`}
      >
        <div
          className={
            returning
              ? 'animate-fade-in flex flex-col gap-4'
              : 'animate-fade-in grid items-stretch gap-8 grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))]'
          }
        >
          <Header returning={returning} />
          {challenges && challenges.length > 0 && (
            <Progress solved={solved} total={challenges.length} next={next} compact={returning} />
          )}
        </div>

        {challenges && (
          <div
            role="group"
            aria-label="Filter by mode"
            className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,230px),1fr))]"
          >
            {MODE_CARDS.map(({ value, description }) => {
              const Icon = value === 'all' ? null : MODE_ICONS[value];
              const name = value === 'all' ? 'All challenges' : MODE_NAMES[value];
              const { solved: done, total } = tally(challenges, value);
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={mode === value}
                  onClick={() => setMode(value)}
                  className="card flex flex-col gap-1.5 p-4 text-left aria-pressed:border-accent aria-pressed:shadow-[0_0_0_1px_var(--accent)]"
                >
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 text-[15px] font-semibold">
                      {Icon && (
                        <Icon
                          className="i"
                          aria-hidden="true"
                          style={{ color: `var(--mode-${value})` }}
                        />
                      )}
                      {name}
                    </span>
                    <span className="mono subtle text-[12px]">
                      {value === 'all' ? total : `${done}/${total}`}
                    </span>
                  </span>
                  <span className="muted text-[13px] leading-[19px]">{description}</span>
                </button>
              );
            })}
          </div>
        )}

        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <Dropdown
              label="Difficulty"
              value={difficulty}
              options={DIFFICULTY_OPTIONS}
              defaultValue="all"
              onChange={setDifficulty}
            />
            <Dropdown
              label="Status"
              value={status}
              options={STATUS_OPTIONS}
              defaultValue="all"
              onChange={setStatus}
            />
            <div className="search ml-auto w-[min(100%,280px)]">
              <Search className="i" aria-hidden="true" />
              <input
                type="search"
                placeholder="Search title or tag"
                aria-label="Search title or tag"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="input h-[30px] text-[13px]"
              />
            </div>
          </div>

          {error && <p className="text-danger">Couldn't load challenges: {error}</p>}
          {!challenges && !error && <Spinner className="subtle" />}

          {challenges && visible.length === 0 && (
            <div className="card animate-fade-in flex flex-col items-center gap-3 p-6 text-center">
              <span className="font-semibold">No challenges match</span>
              <span className="muted text-[13px] leading-[19px]">
                Try other filters, or clear them.
              </span>
              <Button size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            </div>
          )}

          {visible.length > 0 && (
            <div className="card overflow-x-auto">
              <div className="min-w-[760px]">
                <div
                  className={`subtle grid h-9 items-center border-b border-border pr-4 text-[12px] font-medium ${ROW_COLUMNS}`}
                >
                  <span className="mono pl-[18px]">#</span>
                  <span>
                    <span className="sr-only">Status</span>
                  </span>
                  <span>Challenge</span>
                  <span>Mode</span>
                  <span>Difficulty</span>
                  <span className="text-right">Time</span>
                  <span className="text-right">Best</span>
                </div>
                <ul aria-label="Challenges">
                  {visible.map((c, i) => (
                    <li
                      key={c.id}
                      className="animate-fade-in"
                      style={{ animationDelay: `${i * 20}ms` }}
                    >
                      <a
                        href={challengePath(c.id)}
                        onClick={(e) => {
                          // Always stay in this tab: a hosted new tab wouldn't have the access token.
                          e.preventDefault();
                          navigate(challengePath(c.id));
                        }}
                        className={`row-link min-h-[52px] pr-4 ${ROW_COLUMNS}`}
                      >
                        <span className="mono subtle pl-[18px] text-[12px]">
                          {String(positions.get(c.id) ?? 0).padStart(2, '0')}
                        </span>
                        <span className="flex">
                          <StatusIcon status={c.progress.status} />
                        </span>
                        <span className="flex min-w-0 flex-col gap-0.5 py-2 pr-3">
                          <span className="flex min-w-0 items-center gap-2 text-[14px] font-medium">
                            <span className="min-w-0 truncate">{c.title}</span>
                            {next?.id === c.id && (
                              <span className="tag tag-ai h-5 shrink-0 text-[11px]">Up next</span>
                            )}
                          </span>
                          <span className="mono subtle truncate text-[12px]">
                            {c.tags.join(' · ')}
                          </span>
                        </span>
                        <span className="flex">
                          <ModeBadge mode={c.mode} />
                        </span>
                        <span className="flex">
                          <DifficultyBadge difficulty={c.difficulty} />
                        </span>
                        <span className="mono muted text-right text-[13px]">
                          {c.estimatedMinutes}m
                        </span>
                        <span className="mono text-fg text-right text-[13px]">
                          {bestOf(c) ?? (
                            <>
                              <span aria-hidden="true">–</span>
                              <span className="sr-only">None yet</span>
                            </>
                          )}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          {visible.length > 0 && (
            <p className="subtle text-[12px]">
              Best is your best solve time, or your best score for a review. Numbers show the
              suggested order.
            </p>
          )}
        </section>

        <HowItWorks open={howOpen} onToggle={() => setHowOpenChoice(!howOpen)} />
      </main>
    </div>
  );
}

/** The tagline. Large for a new player; compact once they have started, to bring the list up. */
function Header({ returning }: { returning: boolean }) {
  const tagline = 'In the era of AI, practice the skills you actually need.';
  if (returning) {
    return <h1 className="text-[20px] leading-7 font-semibold tracking-tight">{tagline}</h1>;
  }
  return (
    <div className="flex flex-col justify-center gap-3.5">
      <h1 className="max-w-[560px] text-[34px] leading-[42px] font-semibold tracking-[-0.02em]">
        {tagline}
      </h1>
      <p className="muted max-w-[520px] text-[16px] leading-[25px]">
        Debug code you didn't write. Add features without breaking what works. Review pull requests
        like a teammate.
      </p>
      <p className="subtle flex items-center gap-2 text-[13px]">
        <Terminal className="i i-sm" aria-hidden="true" />
        Runs on your machine. No account.
      </p>
    </div>
  );
}

/** How far along you are, and one obvious next step. */
function Progress({
  solved,
  total,
  next,
  compact,
}: {
  solved: number;
  total: number;
  next: ChallengeSummary | undefined;
  /** One row, so a returning player's list stays near the top. */
  compact: boolean;
}) {
  const percent = Math.round((solved / total) * 100);
  return (
    <section
      aria-label="Your progress"
      className={`card card-raised flex gap-4 ${
        compact ? 'flex-wrap items-center gap-x-6 px-5 py-4' : 'flex-col p-5'
      }`}
    >
      <div className="flex min-w-60 flex-1 flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <span className="text-[15px] font-semibold">
            {solved} of {total} solved
          </span>
          <span className="mono subtle text-[13px]">{percent}%</span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={solved}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-label="Challenges solved"
          className="progress"
        >
          <span
            className="bg-success transition-[width] duration-200"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
      {next ? (
        <Button
          variant="primary"
          size="lg"
          className="justify-between"
          onClick={() => navigate(challengePath(next.id))}
        >
          <span className="min-w-0 truncate">
            {next.progress.status === 'in_progress' ? 'Continue' : 'Start'}: {next.title}
          </span>
          <ArrowRight className="i" aria-hidden="true" />
        </Button>
      ) : (
        <span className="text-success">Every challenge solved. Nice work.</span>
      )}
    </section>
  );
}

function HowItWorks({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <section aria-labelledby="how-it-works" className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <h2 id="how-it-works" className="text-[17px] leading-6 font-semibold">
          How it works
        </h2>
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={open}
          aria-controls={open ? 'how-it-works-steps' : undefined}
          onClick={onToggle}
        >
          {open ? 'Hide' : 'Show'}
          {open ? (
            <ChevronUp className="i i-sm" aria-hidden="true" />
          ) : (
            <ChevronDown className="i i-sm" aria-hidden="true" />
          )}
        </Button>
      </div>
      {open && (
        <div
          id="how-it-works-steps"
          className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))]"
        >
          {HOW_IT_WORKS.map(({ mode, steps }) => (
            <div key={mode} className="card flex flex-col gap-3 p-[18px]">
              <div className="flex">
                <ModeBadge mode={mode} />
              </div>
              <ol className="flex list-decimal flex-col gap-2 pl-5 text-[14px] leading-[21px]">
                {steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** Solved and total challenges in one mode. "All" counts every mode. */
function tally(list: ChallengeSummary[], mode: ModeFilter) {
  const inMode = list.filter((c) => mode === 'all' || c.mode === mode);
  return {
    solved: inMode.filter((c) => c.progress.status === 'solved').length,
    total: inMode.length,
  };
}

/** Your best result: a solve time, or a self-graded score for a review. Undefined if none yet. */
function bestOf(c: ChallengeSummary): string | undefined {
  const { bestTimeMs, bestScore } = c.progress;
  if (c.mode === 'review') return bestScore === undefined ? undefined : `${bestScore}%`;
  return bestTimeMs === undefined ? undefined : formatDuration(bestTimeMs);
}

function StatusIcon({ status }: { status: ChallengeStatus }) {
  const label = STATUS_LABEL[status];
  if (status === 'solved') {
    return <CheckCircle2 className="i text-success" role="img" aria-label={label} />;
  }
  if (status === 'in_progress') {
    return <CircleDot className="i text-accent" role="img" aria-label={label} />;
  }
  return <Circle className="i text-fg-3" role="img" aria-label={label} />;
}
