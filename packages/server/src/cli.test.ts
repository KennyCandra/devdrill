import { describe, expect, it } from 'vitest';
import { parseCliArgs } from './cli.js';

describe('parseCliArgs', () => {
  it('defaults to opening the browser on the default port', () => {
    expect(parseCliArgs([])).toEqual({ help: false, version: false, open: true, port: undefined });
  });

  it('reads --no-open and --port', () => {
    expect(parseCliArgs(['--no-open', '--port', '4000'])).toMatchObject({
      open: false,
      port: 4000,
    });
  });

  it('reads short flags', () => {
    expect(parseCliArgs(['-h'])).toMatchObject({ help: true });
    expect(parseCliArgs(['-v'])).toMatchObject({ version: true });
  });

  it.each(['abc', '0', '70000', '3.5'])('rejects --port %s', (port) => {
    expect(() => parseCliArgs(['--port', port])).toThrow('--port must be');
  });

  it('rejects unknown options', () => {
    expect(() => parseCliArgs(['--nope'])).toThrow();
  });
});
