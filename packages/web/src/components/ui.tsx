import type { ComponentProps, ReactNode } from 'react';
import type { Difficulty } from '@bughunt/shared';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent-bg text-on-accent hover:bg-accent-bg-hover',
  secondary: 'bg-hover text-fg hover:bg-active border border-line-strong',
  ghost: 'text-fg hover:bg-hover',
  danger: 'bg-danger-bg text-danger border border-danger/40 hover:border-danger',
};

export function Button({
  variant = 'secondary',
  className = '',
  ...props
}: ComponentProps<'button'> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`inline-flex h-7 items-center gap-1.5 rounded px-3 text-[13px] whitespace-nowrap transition-colors duration-100 focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}

const DIFFICULTY_STYLE: Record<Difficulty, string> = {
  easy: 'text-success bg-success-bg',
  medium: 'text-warning bg-hover',
  hard: 'text-danger bg-danger-bg',
};

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return (
    <span
      className={`rounded px-1.5 py-px text-[11px] font-medium capitalize ${DIFFICULTY_STYLE[difficulty]}`}
    >
      {difficulty}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-line-strong px-1 font-mono text-[10px] text-muted">
      {children}
    </kbd>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block size-3 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  );
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
      <h1 className="text-[15px] font-semibold">{title}</h1>
      <div className="max-w-md leading-relaxed text-muted">{children}</div>
      {action}
    </main>
  );
}

const platform =
  typeof navigator === 'undefined'
    ? ''
    : ((navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
        ?.platform ?? navigator.userAgent);
export const isMac = /mac|iphone|ipad/i.test(platform);
export const modKey = isMac ? '⌘' : 'Ctrl';
