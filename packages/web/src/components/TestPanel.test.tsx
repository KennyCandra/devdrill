import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { TestRunResult } from '@devdrill/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { TestPanel } from './TestPanel';

const silentRun: TestRunResult = {
  status: 'passed',
  passed: 1,
  failed: 0,
  total: 1,
  tests: [
    { file: 'tests/a.test.js', name: 'works', status: 'passed', hidden: false, durationMs: 1 },
  ],
  fileErrors: [],
  durationMs: 100,
};

const noisyRun: TestRunResult = {
  ...silentRun,
  tests: [
    {
      file: 'tests/a.test.js',
      name: 'works',
      status: 'passed',
      hidden: false,
      durationMs: 1,
      logs: [{ stream: 'stdout', text: 'hello from the code\n' }],
    },
  ],
};

const openConsole = () => fireEvent.click(screen.getByRole('button', { name: /Console/ }));

afterEach(cleanup);

describe('TestPanel console', () => {
  it('has no switch before the first run', () => {
    render(<TestPanel result={null} running={false} error={null} />);
    expect(screen.queryByRole('button', { name: /Console/ })).toBeNull();
  });

  it('says so when a run printed nothing', () => {
    render(<TestPanel result={silentRun} running={false} error={null} />);
    openConsole();
    expect(screen.getByText(/Nothing printed in this run/)).toBeTruthy();
  });

  it('shows what a run printed, with a count', () => {
    render(<TestPanel result={noisyRun} running={false} error={null} />);
    expect(screen.getByRole('button', { name: 'Console 1' })).toBeTruthy();
    openConsole();
    expect(screen.getByText(/hello from the code/)).toBeTruthy();
    expect(screen.queryByText(/Nothing printed/)).toBeNull();
  });

  it('stays on the console when the next run prints nothing', () => {
    const { rerender } = render(<TestPanel result={noisyRun} running={false} error={null} />);
    openConsole();
    rerender(<TestPanel result={silentRun} running={false} error={null} />);
    expect(screen.getByText(/Nothing printed in this run/)).toBeTruthy();
  });
});
