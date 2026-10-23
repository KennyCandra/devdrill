// Vitest reporter that saves every console.log/console.error from a challenge run, with the
// test that printed it, as JSON lines in the file named by DEVDRILL_CONSOLE_FILE.
// The test runner reads that file after the run (packages/server/src/services/testRunner.ts).
// Lines are appended one at a time, so logs survive even if the run is killed (infinite loop).

import { appendFileSync } from 'node:fs';

const OUT = process.env.DEVDRILL_CONSOLE_FILE;

export default class ConsoleReporter {
  onInit(vitest) {
    this.vitest = vitest;
  }

  onUserConsoleLog(log) {
    if (!OUT) return;
    const task = log.taskId ? this.vitest?.state?.idMap?.get(log.taskId) : undefined;
    const entry = { stream: log.type, text: log.content, ...describeTask(task) };
    appendFileSync(OUT, JSON.stringify(entry) + '\n');
  }
}

/** The test file and, for logs printed inside a test, the "describe > test" name. */
function describeTask(task) {
  if (!task) return {};
  const file = task.file?.filepath ?? task.filepath;
  if (task.type !== 'test') return { file };
  const names = [];
  for (let t = task; t && t !== task.file; t = t.suite) names.unshift(t.name);
  return { file, test: names.join(' > ') };
}
