import { Settings } from 'lucide-react';
import type { ReactNode } from 'react';
import { navigate } from '../router';
import { Logo } from './ui';

/**
 * The thin bar at the top of every screen, like VS Code's title bar.
 * `children` sit after the logo; `right` sits at the right edge, before Settings.
 */
export function TopBar({ children, right }: { children?: ReactNode; right?: ReactNode }) {
  return (
    <header className="topbar shrink-0">
      <button
        type="button"
        onClick={() => navigate('/')}
        className="flex shrink-0 items-center gap-2 rounded-md px-1.5 py-1 hover:bg-surface-hover"
      >
        <Logo />
        <span className="mono text-[15px] font-semibold">devdrill</span>
      </button>
      {children}
      <div className="ml-auto flex min-w-0 shrink items-center gap-2">{right}</div>
      <button
        type="button"
        onClick={() => navigate('/settings')}
        aria-label="Settings"
        title="Settings"
        className="btn btn-ghost btn-icon btn-sm shrink-0"
      >
        <Settings size={16} aria-hidden="true" />
      </button>
    </header>
  );
}
