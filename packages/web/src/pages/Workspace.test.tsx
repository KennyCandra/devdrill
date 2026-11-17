import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ChallengeDetail } from '@devdrill/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import { Workspace } from './Workspace';

// The page talks to the server only through `api`; Monaco is replaced by an empty stub.
vi.mock('../api/client', () => ({
  ApiRequestError: class ApiRequestError extends Error {},
  api: {
    challenge: vi.fn(),
    start: vi.fn(),
    readFile: vi.fn(),
    saveFile: vi.fn(),
    saveFileOnUnload: vi.fn(),
    reset: vi.fn(),
    aiStatus: vi.fn(),
    aiHint: vi.fn(),
    run: vi.fn(),
    submit: vi.fn(),
  },
}));
vi.mock('../workspace/CodeEditor', () => ({ CodeEditor: () => null }));

const challenge = {
  id: 'debug-001-sample',
  title: 'Sample',
  mode: 'debug',
  difficulty: 'easy',
  readme: '# Sample',
  hints: ['First hint', 'Second hint'],
  languages: ['js'],
  progress: { attempts: 0 },
} as unknown as ChallengeDetail;

const FILES = ['src/cart.js', 'tests/cart.test.js'];

beforeEach(() => {
  vi.mocked(api.challenge).mockResolvedValue(challenge);
  vi.mocked(api.start).mockResolvedValue({ files: FILES } as Awaited<ReturnType<typeof api.start>>);
  vi.mocked(api.readFile).mockImplementation((_id, path) =>
    Promise.resolve({ path, content: 'code', mtimeMs: 1 }),
  );
  vi.mocked(api.reset).mockResolvedValue({ files: FILES } as Awaited<ReturnType<typeof api.reset>>);
  vi.mocked(api.aiStatus).mockResolvedValue({ enabled: false });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
});

async function openWorkspace() {
  render(<Workspace id="debug-001-sample" lang="js" />);
  return {
    tabs: within(await screen.findByRole('navigation', { name: 'Open files' })),
    tree: within(screen.getByRole('navigation', { name: 'Files' })),
  };
}

describe('Workspace README tab', () => {
  it('lists the README first in the file tree and opens it as the first, active tab', async () => {
    const { tabs, tree } = await openWorkspace();
    const entries = tree.getAllByRole('button').map((b) => b.textContent);
    expect(entries[0]).toBe('README.md');

    const tabNames = tabs.getAllByRole('button').map((b) => b.textContent);
    expect(tabNames[0]).toBe('README.md');
    expect(tabs.getByRole('button', { name: 'README.md' }).getAttribute('aria-current')).toBe(
      'page',
    );
    // The README's own heading (the top bar has one too).
    expect(document.querySelector('.prose-task h1')?.textContent).toBe('Sample');
  });

  it('shows hints hidden on open, then one more per click', async () => {
    await openWorkspace();
    expect(screen.queryByText('First hint')).toBeNull();
    expect(screen.getByText('0 of 2 shown')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Need a hint?' }));
    expect(screen.getByText('First hint')).toBeTruthy();
    expect(screen.queryByText('Second hint')).toBeNull();
  });

  it('closes and reopens from the file tree like any file', async () => {
    const { tabs, tree } = await openWorkspace();
    fireEvent.click(tabs.getByRole('button', { name: 'Close README.md' }));
    expect(tabs.queryByRole('button', { name: 'README.md' })).toBeNull();

    fireEvent.click(tree.getByRole('button', { name: 'README.md' }));
    expect(tabs.getByRole('button', { name: 'README.md' }).getAttribute('aria-current')).toBe(
      'page',
    );
  });

  it('never reads or saves the README through the server', async () => {
    const { tabs } = await openWorkspace();
    await waitFor(() => expect(api.readFile).toHaveBeenCalled());
    expect(vi.mocked(api.readFile).mock.calls.map(([, path]) => path)).not.toContain('README.md');

    // Revealing a hint changes nothing on disk; reset is the other path that reloads files.
    fireEvent.click(screen.getByRole('button', { name: 'Need a hint?' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset files' }));
    // One read on open (the code file), one after reset: the README is never read.
    await waitFor(() => expect(api.readFile).toHaveBeenCalledTimes(2));

    expect(vi.mocked(api.readFile).mock.calls.map(([, path]) => path)).not.toContain('README.md');
    expect(api.saveFile).not.toHaveBeenCalled();
    expect(tabs.getAllByRole('button').map((b) => b.textContent)[0]).toBe('README.md');
  });
});
