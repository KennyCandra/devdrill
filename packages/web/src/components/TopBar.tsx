import { Bug, Settings } from 'lucide-react';
import type { ReactNode } from 'react';
import { navigate } from '../router';

/** The thin bar at the top of every screen, like VS Code's title bar. */
export function TopBar({ children }: { children?: ReactNode }) {
  return (
    <header className="flex h-10 shrink-0 items-center gap-3 border-b border-line bg-bar px-3">
      <button
        type="button"
        onClick={() => navigate('/')}
        className="flex shrink-0 items-center gap-2 rounded px-1 font-semibold hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent"
      >
        <Bug size={16} className="text-accent" aria-hidden="true" />
        BugHunt
      </button>
      {children}
      <button
        type="button"
        onClick={() => navigate('/settings')}
        aria-label="Settings"
        title="Settings"
        className={`flex size-7 shrink-0 items-center justify-center rounded text-muted hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-accent ${
          children ? '' : 'ml-auto'
        }`}
      >
        <Settings size={16} aria-hidden="true" />
      </button>
    </header>
  );
}
