import { Bug } from 'lucide-react';
import type { ReactNode } from 'react';
import { navigate } from '../router';

/** The thin bar at the top of every screen, like VS Code's title bar. */
export function TopBar({ children }: { children?: ReactNode }) {
  return (
    <header className="flex h-10 shrink-0 items-center gap-3 border-b border-line bg-bar px-3">
      <button
        type="button"
        onClick={() => navigate('/')}
        className="flex items-center gap-2 rounded px-1 font-semibold hover:bg-hover"
      >
        <Bug size={16} className="text-accent" aria-hidden="true" />
        BugHunt
      </button>
      {children}
    </header>
  );
}
