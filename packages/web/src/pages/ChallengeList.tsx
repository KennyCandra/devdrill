import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Circle,
  CircleDot,
  Clock,
  Play,
  Search,
  Send,
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
import { Button, DifficultyBadge, Kbd, modKey, Spinner } from '../components/ui';
import { challengePath, navigate } from '../router';

type ModeFilter = 'all' | ChallengeMode;

const MODE_TABS: { value: ModeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'debug', label: 'Debug' },
  { value: 'feature', label: 'Feature' },
  { value: 'review', label: 'Review' },
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

export function ChallengeList() {
  const [challenges, setChallenges] = useState<ChallengeSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ModeFilter>('all');
  const [difficulty, setDifficulty] = useState<Difficulty | 'all'>('all');
  const [status, setStatus] = useState<ChallengeStatus | 'all'>('all');
  const [query, setQuery] = useState('');

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

  const solved = challenges?.filter((c) => c.progress.status === 'solved').length ?? 0;
  // Pick up where you left off, else the first one you haven't tried.
  const next =
    challenges?.find((c) => c.progress.status === 'in_progress') ??
    challenges?.find((c) => c.progress.status === 'not_started');

  return (
    <div className="flex h-full flex-col">
      <TopBar />

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 overflow-auto px-6 py-6">
        <div className="animate-fade-in flex flex-wrap items-end justify-between gap-3 pb-2">
          <div>
            <h1 className="text-[20px] font-semibold tracking-tight">
              In the era of AI, practice the skills you actually need.
            </h1>
            <p className="mt-1 text-muted">
              Debug code you didn't write. Add features without breaking what works. Review pull
              requests like a teammate.
            </p>
          </div>
          <LanguageSwitch />
        </div>

        {challenges && challenges.length > 0 && (
          <Progress solved={solved} total={challenges.length} next={next} />
        )}

        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Mode" className="flex rounded border border-line">
            {MODE_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                aria-pressed={mode === tab.value}
                onClick={() => setMode(tab.value)}
                className={`px-3 py-1 transition-colors duration-100 focus-visible:outline-2 focus-visible:outline-accent ${
                  mode === tab.value ? 'bg-active text-fg' : 'text-muted hover:bg-hover'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

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

          <label className="ml-auto flex h-7 items-center gap-1.5 rounded border border-line px-2 focus-within:border-accent">
            <Search size={14} className="text-muted" aria-hidden="true" />
            <input
              type="search"
              placeholder="Search title or tag"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-44 bg-transparent outline-none placeholder:text-muted"
            />
          </label>
        </div>

        {error && <p className="text-danger">Couldn't load challenges: {error}</p>}
        {!challenges && !error && <Spinner className="text-muted" />}

        {challenges && visible.length === 0 && (
          <div className="animate-fade-in flex flex-col items-start gap-2 py-8 text-muted">
            <p>No challenges match these filters.</p>
            <Button
              onClick={() => {
                setMode('all');
                setDifficulty('all');
                setStatus('all');
                setQuery('');
              }}
            >
              Clear filters
            </Button>
          </div>
        )}

        {visible.length > 0 && (
          <ul className="divide-y divide-line rounded border border-line">
            {visible.map((c, i) => (
              <li key={c.id} className="animate-fade-in" style={{ animationDelay: `${i * 20}ms` }}>
                <a
                  href={challengePath(c.id)}
                  onClick={(e) => {
                    // Always stay in this tab: a new tab wouldn't have the session token.
                    e.preventDefault();
                    navigate(challengePath(c.id));
                  }}
                  className="flex items-center gap-3 px-3 py-2.5 transition-colors duration-100 hover:bg-hover"
                >
                  <StatusIcon status={c.progress.status} />
                  <span className="min-w-0 flex-1 truncate">{c.title}</span>
                  <span className="hidden w-16 text-muted capitalize sm:inline">{c.mode}</span>
                  <span className="w-16">
                    <DifficultyBadge difficulty={c.difficulty} />
                  </span>
                  <span className="hidden w-14 items-center justify-end gap-1 text-muted sm:flex">
                    <Clock size={12} aria-hidden="true" />~{c.estimatedMinutes}m
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}

        <HowItWorks />
      </main>
    </div>
  );
}

/** How far along you are, and one obvious next step. */
function Progress({
  solved,
  total,
  next,
}: {
  solved: number;
  total: number;
  next: ChallengeSummary | undefined;
}) {
  const percent = Math.round((solved / total) * 100);
  return (
    <section
      aria-label="Your progress"
      className="animate-fade-in flex flex-wrap items-center gap-x-6 gap-y-3 rounded-md border border-line bg-side px-4 py-3"
    >
      <div className="flex min-w-48 flex-1 flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <span className="font-medium">
            {solved} of {total} solved
          </span>
          <span className="text-[12px] text-muted">{percent}%</span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={solved}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-label="Challenges solved"
          className="h-1.5 overflow-hidden rounded-full bg-hover"
        >
          <div
            className="h-full rounded-full bg-success transition-[width] duration-200"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
      {next ? (
        <Button variant="primary" onClick={() => navigate(challengePath(next.id))}>
          {next.progress.status === 'in_progress' ? 'Continue' : 'Start'}: {next.title}
          <ArrowRight size={14} aria-hidden="true" />
        </Button>
      ) : (
        <span className="text-success">Every challenge solved. Nice work.</span>
      )}
    </section>
  );
}

function HowItWorks() {
  return (
    <section aria-labelledby="how-it-works" className="mt-4">
      <h2
        id="how-it-works"
        className="mb-3 text-[11px] font-semibold tracking-wide text-muted uppercase"
      >
        How it works
      </h2>
      <ol className="grid gap-3 sm:grid-cols-3">
        <Step icon={<BookOpen size={16} aria-hidden="true" />} title="1. Read the task">
          Each challenge starts like a real bug report or ticket, with a few files you didn't write.
        </Step>
        <Step icon={<Play size={16} aria-hidden="true" />} title="2. Run the tests">
          Check your work against the visible tests as often as you like: <Kbd>{modKey} Enter</Kbd>.
        </Step>
        <Step icon={<Send size={16} aria-hidden="true" />} title="3. Submit">
          Hidden tests check the edge cases. Solve it, then compare with the reference solution.
        </Step>
      </ol>
    </section>
  );
}

function Step({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <li className="flex flex-col gap-1.5 rounded-md border border-line p-3">
      <span className="flex items-center gap-2 font-medium">
        <span className="text-accent">{icon}</span>
        {title}
      </span>
      <span className="leading-relaxed text-muted">{children}</span>
    </li>
  );
}

function StatusIcon({ status }: { status: ChallengeStatus }) {
  const label = STATUS_LABEL[status];
  if (status === 'solved') {
    return (
      <CheckCircle2 size={16} className="shrink-0 text-success" role="img" aria-label={label} />
    );
  }
  if (status === 'in_progress') {
    return <CircleDot size={16} className="shrink-0 text-accent" role="img" aria-label={label} />;
  }
  return <Circle size={16} className="shrink-0 text-muted" role="img" aria-label={label} />;
}
