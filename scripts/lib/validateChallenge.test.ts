import { cp, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { validateChallenge } from './validateChallenge.js';

// Uses the real challenge #1 as a known-good fixture, then breaks copies of it.
const GOOD = path.resolve(import.meta.dirname, '../../challenges/debug/001-cart-discount');

let root: string;

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'devdrill-validate-test-'));
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

/** Copies the good challenge to `<root>/<name>/debug/001-cart-discount` and applies `change`. */
async function variant(name: string, change: (dir: string) => Promise<void>): Promise<string> {
  const dir = path.join(root, name, 'debug', '001-cart-discount');
  await cp(GOOD, dir, { recursive: true });
  await change(dir);
  return dir;
}

describe('validateChallenge', () => {
  it('accepts the cart discount challenge', async () => {
    const result = await validateChallenge(GOOD);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('rejects a solution that does not fix the bug', async () => {
    const dir = await variant('broken-solution', (d) =>
      cp(path.join(d, 'starter/src/discount.js'), path.join(d, 'solution/src/discount.js')),
    );
    const result = await validateChallenge(dir);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('All tests must pass on solution/');
  });

  it('rejects a starter that has no bug', async () => {
    const dir = await variant('no-bug', (d) =>
      cp(path.join(d, 'solution/src/discount.js'), path.join(d, 'starter/src/discount.js')),
    );
    const result = await validateChallenge(dir);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('at least one visible test must fail');
  });

  it('rejects tests that import vitest', async () => {
    const dir = await variant('imports-vitest', (d) =>
      writeFile(
        path.join(d, 'starter/tests/extra.test.js'),
        `import { it } from 'vitest';\nit('x', () => {});\n`,
      ),
    );
    const result = await validateChallenge(dir);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain(`don't import from "vitest"`);
  });

  it('rejects package dependencies', async () => {
    const dir = await variant('has-deps', (d) =>
      writeFile(
        path.join(d, 'starter/package.json'),
        JSON.stringify({ type: 'module', dependencies: { lodash: '1.0.0' } }),
      ),
    );
    const result = await validateChallenge(dir);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('zero dependencies');
  });

  it.each([
    [
      'a symlink',
      (d: string) => symlink('/etc/hosts', path.join(d, 'starter/src/hosts.js')),
      'no symlinks',
    ],
    [
      'a skipped test',
      (d: string) =>
        writeFile(path.join(d, 'starter/tests/extra.test.js'), `it.skip('x', () => {});\n`),
      'remove .skip/.only/.todo',
    ],
    [
      'a vitest config in solution/',
      (d: string) => writeFile(path.join(d, 'solution/vitest.config.js'), 'export default {};\n'),
      'config files are not allowed',
    ],
    [
      'a spec file in solution/',
      (d: string) => writeFile(path.join(d, 'solution/src/cheat.spec.js'), `it('x', () => {});\n`),
      'must not change tests',
    ],
    [
      'a dynamic import with a computed path',
      (d: string) =>
        writeFile(
          path.join(d, 'starter/src/load.js'),
          'export const load = (m) => import(`${m}`);\n',
        ),
      'plain string path',
    ],
    [
      'a TypeScript file',
      (d: string) => writeFile(path.join(d, 'starter/src/x.ts'), 'export const x = 1;\n'),
      'only plain .js files',
    ],
  ])('rejects %s', async (name, change, expected) => {
    const dir = await variant(name.replace(/\W+/g, '-'), change);
    const result = await validateChallenge(dir);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain(expected);
  });

  it('ignores the word "from" in comments and .DS_Store files', async () => {
    const dir = await variant('comment-and-ds-store', async (d) => {
      const file = path.join(d, 'starter/src/cart.js');
      await writeFile(file, `// copied from "the old checkout"\n${await readFile(file, 'utf8')}`);
      await writeFile(path.join(d, 'hidden-tests/.DS_Store'), '');
    });
    const result = await validateChallenge(dir);
    expect(result.errors).toEqual([]);
  });

  it('requires every hidden test to name a README rule that exists', async () => {
    const dir = await variant('bad-rules', async (d) => {
      const file = path.join(d, 'challenge.json');
      const meta = JSON.parse(await readFile(file, 'utf8')) as {
        hiddenTestRules: Record<string, string>;
      };
      const [first, second] = Object.keys(meta.hiddenTestRules);
      delete meta.hiddenTestRules[first!];
      meta.hiddenTestRules[second!] = 'A sentence that is not in the README.';
      await writeFile(file, JSON.stringify(meta));
    });
    const errors = (await validateChallenge(dir)).errors.join('\n');
    expect(errors).toContain('add the README sentence that hidden test');
    expect(errors).toContain("isn't in README.md");
  });

  it('requires a Data section in the README', async () => {
    const dir = await variant('no-data', async (d) => {
      const file = path.join(d, 'README.md');
      await writeFile(file, (await readFile(file, 'utf8')).replace('## Data', '## Shapes'));
    });
    const result = await validateChallenge(dir);
    expect(result.errors.join('\n')).toContain('needs a "## Data" section');
  });

  it('requires a code example in the README', async () => {
    const dir = await variant('no-example', (d) =>
      writeFile(path.join(d, 'README.md'), '# Title\n\nFix the bug.\n'),
    );
    const result = await validateChallenge(dir);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('needs an example of the exact result');
  });

  it('rejects an id that does not match the folder', async () => {
    const dir = await variant('bad-id', async (d) => {
      const file = path.join(d, 'challenge.json');
      const meta = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>;
      meta.id = 'wrong';
      await writeFile(file, JSON.stringify(meta));
    });
    const result = await validateChallenge(dir);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('"id" must be "debug-001-cart-discount"');
  });
}, 60_000);
