import type { ComponentProps, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Crosshair, GitPullRequest, SquarePlus } from 'lucide-react';
import type { ChallengeMode, Difficulty } from '@devdrill/shared';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
};

const SIZES = { sm: 'btn-sm', lg: 'btn-lg' } as const;

export function Button({
  variant = 'secondary',
  size,
  className = '',
  ...props
}: ComponentProps<'button'> & { variant?: Variant; size?: keyof typeof SIZES }) {
  return (
    <button
      type="button"
      className={`btn ${VARIANTS[variant]} ${size ? SIZES[size] : ''} ${className}`}
      {...props}
    />
  );
}

const DIFFICULTY_BARS: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3 };

/** Difficulty as three bars and a word, so it never relies on colour alone. */
export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  const filled = DIFFICULTY_BARS[difficulty];
  return (
    <span className="diff">
      <span className="diff-bars" aria-hidden="true">
        {[1, 2, 3].map((bar) => (
          <i key={bar} className={bar <= filled ? 'on' : undefined} />
        ))}
      </span>
      <span className="capitalize">{difficulty}</span>
    </span>
  );
}

const MODE_ICONS: Record<ChallengeMode, LucideIcon> = {
  debug: Crosshair,
  feature: SquarePlus,
  review: GitPullRequest,
};

const MODE_NAMES: Record<ChallengeMode, string> = {
  debug: 'Debug',
  feature: 'Feature',
  review: 'Review',
};

/** The mode of a challenge: its icon and name, in the mode's colour. */
export function ModeBadge({ mode }: { mode: ChallengeMode }) {
  const Icon = MODE_ICONS[mode];
  return (
    <span className={`mode mode-${mode}`}>
      <Icon className="i" aria-hidden="true" />
      {MODE_NAMES[mode]}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}

/** A ring that turns; with reduced motion it stays still (see `.spin`). */
export function Spinner({ className = '' }: { className?: string }) {
  return <span aria-hidden="true" className={`spin ${className}`} />;
}

/** Full-screen message for "can't connect", "reopen the link", "not found" and similar. */
export function StatusScreen({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <main className="animate-fade-in flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-[17px] leading-6 font-semibold">{title}</h1>
      <div className="muted max-w-md leading-relaxed">{children}</div>
      {action}
    </main>
  );
}

/** The DevDrill mark: a rounded square holding `//`, in the primary colour. Decorative. */
export function Logo({ size = 22, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <rect width="24" height="24" rx="6" style={{ fill: 'var(--primary)' }} />
      <path
        d="M10.4 6.5 7.6 17.5M16.4 6.5l-2.8 11"
        fill="none"
        stroke="#fff"
        strokeWidth={2.3}
        strokeLinecap="round"
      />
    </svg>
  );
}

const platform =
  typeof navigator === 'undefined'
    ? ''
    : ((navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
        ?.platform ?? navigator.userAgent);
export const isMac = /mac|iphone|ipad/i.test(platform);
export const modKey = isMac ? '⌘' : 'Ctrl';
