import { Bug, Settings } from 'lucide-react';
import type { ReactNode } from 'react';
import { navigate } from '../router';
import { PRODUCT_NAME } from '../brand';

/**
 * The thin bar at the top of every screen, like VS Code's title bar.
 * `children` sit after the logo; `right` sits at the right edge, before Settings.
 */
export function TopBar({ children, right }: { children?: ReactNode; right?: ReactNode }) {
  return (
    <header className="flex h-10 shrink-0 items-center gap-3 border-b border-line bg-bar px-3">
      <button
        type="button"
        onClick={() => navigate('/')}
        className="flex shrink-0 items-center gap-2 rounded px-1 font-semibold hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent"
      >
        <Bug size={16} className="text-accent" aria-hidden="true" />
        {PRODUCT_NAME}
      </button>
      {children}
      <div className="ml-auto flex min-w-0 shrink items-center gap-2">{right}</div>
      <button
        type="button"
        onClick={() => navigate('/settings')}
        aria-label="Settings"
        title="Settings"
        className="flex size-7 shrink-0 items-center justify-center rounded text-muted hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-accent"
      >
        <Settings size={16} aria-hidden="true" />
      </button>
    </header>
  );
}
