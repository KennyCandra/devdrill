import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { validateChallenge } from './validateChallenge.js';

// The real review #1 is the known-good fixture; each test breaks a copy of it.
const REVIEW = path.resolve(import.meta.dirname, '../../challenges/review');
const GOOD = path.join(REVIEW, '001-order-coupons');

let root: string;

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'devdrill-validate-review-'));
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

/** Copies the challenge (and the issue types next to it) under `<root>/<name>/review/`. */
async function variant(name: string, change: (dir: string) => Promise<void>): Promise<string> {
  const reviewDir = path.join(root, name, 'review');
  const dir = path.join(reviewDir, '001-order-coupons');
  await cp(GOOD, dir, { recursive: true });
  await cp(path.join(REVIEW, 'issue-types.json'), path.join(reviewDir, 'issue-types.json'));
  await change(dir);
  return dir;
}

async function editJson(file: string, change: (value: unknown[]) => unknown[]): Promise<void> {
  const value = JSON.parse(await readFile(file, 'utf8')) as unknown[];
  await writeFile(file, JSON.stringify(change(value)));
}

const errorsOf = async (dir: string) => (await validateChallenge(dir)).errors.join('\n');

describe('validateChallenge (review)', () => {
  it('accepts the order coupons review', async () => {
    expect((await validateChallenge(GOOD)).errors).toEqual([]);
  });

  it('accepts a clean pull request with an empty answer key', async () => {
    const dir = await variant('clean', async (d) => {
      await writeFile(path.join(d, 'js/issues.json'), '[]');
      await writeFile(path.join(d, 'ts/issues.json'), '[]');
    });
    expect(await errorsOf(dir)).toBe('');
  });

  it('rejects an issue on lines the pull request did not change', async () => {
    const dir = await variant('unchanged-lines', (d) =>
      editJson(path.join(d, 'js/issues.json'), (issues) =>
        issues.map((i, n) => (n === 2 ? { ...(i as object), lines: [5, 6] } : i)),
      ),
    );
    expect(await errorsOf(dir)).toContain("don't include a line the pull request changed");
  });

  it('rejects a function issue whose lines are not the function', async () => {
    const dir = await variant('wrong-function-lines', (d) =>
      editJson(path.join(d, 'js/issues.json'), (issues) =>
        issues.map((i, n) => (n === 0 ? { ...(i as object), lines: [18, 21] } : i)),
      ),
    );
    expect(await errorsOf(dir)).toContain('function applyCoupon is at lines 18-23');
  });

  it('rejects answer keys that differ between languages', async () => {
    const dir = await variant('languages-differ', (d) =>
      editJson(path.join(d, 'ts/issues.json'), (issues) => issues.slice(0, 2)),
    );
    expect(await errorsOf(dir)).toContain('ts/issues.json is missing "free-shipping-magic-number"');
  });

  it('rejects a pull request whose tests fail', async () => {
    const dir = await variant('red-ci', (d) =>
      writeFile(
        path.join(d, 'js/head/tests/extra.test.js'),
        `it('fails', () => { expect(1).toBe(2); });\n`,
      ),
    );
    expect(await errorsOf(dir)).toContain("The pull request's tests must pass");
  });

  it('rejects a pull request that changes nothing', async () => {
    const dir = await variant('no-change', async (d) => {
      await rm(path.join(d, 'js/head'), { recursive: true });
      await cp(path.join(d, 'js/base/src'), path.join(d, 'js/head/src'), { recursive: true });
    });
    expect(await errorsOf(dir)).toContain('head/ must change at least one file');
  });
});
