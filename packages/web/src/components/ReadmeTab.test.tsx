import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ChallengeDetail } from '@devdrill/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { ReadmeTab } from './ReadmeTab';

const challenge = {
  id: 'debug-001-sample',
  mode: 'debug',
  readme: '# Sample',
  hints: ['First hint', 'Second hint'],
} as ChallengeDetail;

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('ReadmeTab hints', () => {
  it('hides every hint when opened', () => {
    render(<ReadmeTab challenge={challenge} />);
    expect(screen.queryByText('First hint')).toBeNull();
    expect(screen.getByText('0 of 2 shown')).toBeTruthy();
  });

  it('ignores hints a player revealed on an earlier visit', () => {
    localStorage.setItem('devdrill-hints-debug-001-sample', '2');
    render(<ReadmeTab challenge={challenge} />);
    expect(screen.queryByText('First hint')).toBeNull();
  });

  it('shows one more hint each time the player asks', () => {
    render(<ReadmeTab challenge={challenge} />);
    fireEvent.click(screen.getByRole('button', { name: 'Need a hint?' }));
    expect(screen.getByText('First hint')).toBeTruthy();
    expect(screen.queryByText('Second hint')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Next hint/ }));
    expect(screen.getByText('Second hint')).toBeTruthy();
  });

  it('forgets revealed hints when the tab is opened again', () => {
    const { unmount } = render(<ReadmeTab challenge={challenge} />);
    fireEvent.click(screen.getByRole('button', { name: 'Need a hint?' }));
    unmount();
    render(<ReadmeTab challenge={challenge} />);
    expect(screen.queryByText('First hint')).toBeNull();
  });
});
