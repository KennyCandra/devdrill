import { CheckCircle2, Circle, CircleDot, Clock, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type {
  ChallengeMode,
  ChallengeStatus,
  ChallengeSummary,
  Difficulty,
} from '@devdrill/shared';
import { api } from '../api/client';
import { TopBar } from '../components/TopBar';
import { Button, DifficultyBadge, Spinner } from '../components/ui';
import { challengePath, navigate } from '../router';

type ModeFilter = 'all' | ChallengeMode;

const MODE_TABS: { value: ModeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'debug', label: 'Debug' },
  { value: 'feature', label: 'Feature' },
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

  useEffect(() => {
    api
      .challenges()
      .then(setChallenges)
      .catch((err: Error) => setError(err.message));
  }, []);

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

  return (
    <div className="flex h-full flex-col">
      <TopBar
        right={
          challenges && (
            <span className="text-muted">
              {solved} of {challenges.length} solved
            </span>
          )
        }
      />

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 overflow-auto px-6 py-6">
        <div className="animate-fade-in pb-2">
          <h1 className="text-[20px] font-semibold tracking-tight">
            In the era of AI, practice the skills you actually need.
          </h1>
          <p className="mt-1 text-muted">
            Debug code you didn't write. Add features without breaking what works.
          </p>
        </div>

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

          <select
            aria-label="Difficulty"
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as Difficulty | 'all')}
            className="h-7 rounded border border-line bg-bg px-2"
          >
            <option value="all">Any difficulty</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>

          <select
            aria-label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as ChallengeStatus | 'all')}
            className="h-7 rounded border border-line bg-bg px-2"
          >
            <option value="all">Any status</option>
            <option value="not_started">Not started</option>
            <option value="in_progress">In progress</option>
            <option value="solved">Solved</option>
          </select>

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
      </main>
    </div>
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
