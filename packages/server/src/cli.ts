import { parseArgs } from 'node:util';
import { APP_NAME } from './config.js';

export interface CliOptions {
  help: boolean;
  version: boolean;
  open: boolean;
  /** Undefined means "3000, or any free port if it's taken". */
  port?: number;
}

export const HELP = `Usage: npx ${APP_NAME} [options]

Practice debugging and adding features to real code, in your browser.
Starts a local server and opens the app. Your code and progress stay in
~/.${APP_NAME} (or the folder in the DEVDRILL_HOME environment variable).

Options:
  --port <number>  Use this port instead of 3000 (fails if it's taken)
  --no-open        Don't open a browser; just print the link
  -v, --version    Print the version
  -h, --help       Print this help
`;

/** Parses command-line arguments. Throws an Error with a user-facing message if they're wrong. */
export function parseCliArgs(argv: string[]): CliOptions {
  const { values } = parseArgs({
    args: argv,
    options: {
      help: { type: 'boolean', short: 'h', default: false },
      version: { type: 'boolean', short: 'v', default: false },
      open: { type: 'boolean', default: true },
      port: { type: 'string' },
    },
    allowNegative: true,
    strict: true,
  });

  let port: number | undefined;
  if (values.port !== undefined) {
    // Digits only: Number() would also accept "0x10" and "1e3".
    port = /^\d+$/.test(values.port) ? Number(values.port) : NaN;
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error(`--port must be a number from 1 to 65535, not "${values.port}".`);
    }
  }

  return { help: values.help, version: values.version, open: values.open, port };
}
