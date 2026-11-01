// Runs the three code states of "Not quite yet" with the app's own Vitest and saves what it
// said. Every test name, count and message in the film comes from the file this writes:
// npx tsx docs/film/tools/nqy-session.mjs
/* global console */
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { runTests } from '../../../packages/server/src/services/testRunner.ts';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const CHALLENGE = path.join(ROOT, 'challenges/debug/004-async-report');
const STARTER = path.join(CHALLENGE, 'js/starter');
const HIDDEN = path.join(CHALLENGE, 'js/hidden-tests');
const meta = JSON.parse(readFileSync(path.join(CHALLENGE, 'challenge.json'), 'utf8'));
const bug = readFileSync(path.join(STARTER, 'src/report.js'), 'utf8');

const swap = (text, from, to) => {
  if (!text.includes(from)) throw new Error(`Not in the code: ${from}`);
  return text.replace(from, to);
};

const firstFix = swap(
  swap(
    bug,
    '  storeIds.forEach(async (storeId) => {',
    '  await Promise.all(storeIds.map(async (storeId) => {',
  ),
  '    });\n  });\n',
  '    });\n  }));\n',
);

const realFix = swap(
  swap(
    swap(
      swap(firstFix, '  const rows = [];\n\n', ''),
      '  await Promise.all(storeIds.map(async (storeId) => {',
      '  const rows = await Promise.all(storeIds.map(async (storeId) => {',
    ),
    '    rows.push({',
    '    return {',
  ),
  '    });\n  }));\n',
  '    };\n  }));\n',
);

const STATES = { bug, firstFix, realFix };

/** What the app's submit route does to a run: hidden flags, rules, withheld details. */
const asSubmitted = (run) => {
  const solved = run.status === 'passed';
  const tests = run.tests.map((t) => {
    const hidden = t.file.endsWith('.hidden.test.js');
    const rule = hidden ? meta.hiddenTestRules[t.name] : undefined;
    const full = { ...t, hidden, ...(rule ? { rule } : {}) };
    if (solved || !hidden) return full;
    const rest = { ...full };
    delete rest.message;
    delete rest.logs;
    return t.status === 'failed' ? { ...rest, detailsHidden: true } : rest;
  });
  return { ...run, tests };
};

const inFolder = async (code, withHidden) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'nqy-session-'));
  try {
    cpSync(STARTER, dir, { recursive: true });
    if (withHidden) cpSync(HIDDEN, dir, { recursive: true });
    writeFileSync(path.join(dir, 'src/report.js'), code);
    return await runTests(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

const out = {
  ranOn: new Date().toISOString().slice(0, 10),
  challenge: 'challenges/debug/004-async-report',
};
const counts = {};
for (const [name, code] of Object.entries(STATES)) {
  const visible = await inFolder(code, false);
  const submitted = asSubmitted(await inFolder(code, true));
  out[name] = { code, visible, submitted };
  counts[name] =
    `visible ${visible.passed} passed ${visible.failed} failed; ` +
    `with hidden ${submitted.passed} of ${submitted.total}`;
}
writeFileSync(path.join(ROOT, 'docs/film/session.json'), `${JSON.stringify(out, null, 2)}\n`);
console.log(counts);
process.exit(0);
