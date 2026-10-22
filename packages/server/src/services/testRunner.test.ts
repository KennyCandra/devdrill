import { mkdtemp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runTests } from './testRunner.js';

const dirs: string[] = [];

async function project(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'devdrill-runner-test-'));
  dirs.push(dir);
  await writeFile(path.join(dir, 'package.json'), '{ "type": "module" }');
  for (const [name, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(dir, name)), { recursive: true });
    await writeFile(path.join(dir, name), content);
  }
  return dir;
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

describe('runTests', () => {
  it('reports passed and failed tests with relative file paths', async () => {
    const dir = await project({
      'tests/math.test.js': `
        describe('math', () => {
          it('adds', () => { expect(1 + 1).toBe(2); });
          it('is wrong', () => { expect(1 + 1).toBe(3); });
        });`,
    });

    const result = await runTests(dir);

    expect(result.status).toBe('failed');
    expect(result).toMatchObject({ passed: 1, failed: 1, total: 2 });
    expect(result.tests.map((t) => [t.file, t.name, t.status])).toEqual([
      ['tests/math.test.js', 'math > adds', 'passed'],
      ['tests/math.test.js', 'math > is wrong', 'failed'],
    ]);
    expect(result.tests[1]?.message).toContain('expected 2 to be 3');
    // Paths are relative and Vitest's own stack frames are gone.
    expect(result.tests[1]?.message).toContain('tests/math.test.js:');
    expect(result.tests[1]?.message).not.toContain(dir);
    expect(result.tests[1]?.message).not.toContain('node_modules');
  });

  it('passes when every test passes', async () => {
    const dir = await project({ 'a.test.js': `it('ok', () => { expect(true).toBe(true); });` });
    const result = await runTests(dir);
    expect(result.status).toBe('passed');
  });

  it('reports a file that cannot load as a file error', async () => {
    const dir = await project({ 'broken.test.js': 'export function broken( {' });
    const result = await runTests(dir);
    expect(result.status).toBe('failed');
    expect(result.fileErrors).toHaveLength(1);
    expect(result.fileErrors[0]?.file).toBe('broken.test.js');
  });

  it('treats a folder with no tests as failed', async () => {
    const dir = await project({ 'src/index.js': 'export const x = 1;' });
    const result = await runTests(dir);
    expect(result.status).toBe('failed');
    expect(result.total).toBe(0);
  });

  it.each([
    ['beforeAll throws', `beforeAll(() => { throw new Error('boom'); }); it('x', () => {});`],
    ['afterAll throws', `afterAll(() => { throw new Error('boom'); }); it('x', () => {});`],
    [
      'a promise rejects without being awaited',
      `it('x', () => { void Promise.reject(new Error('unhandled')); });`,
    ],
  ])('fails when %s', async (_label, source) => {
    const dir = await project({ 'a.test.js': source });
    const result = await runTests(dir);
    expect(result.status).toBe('failed');
  });

  it('does not count a run where every test is skipped as passed', async () => {
    const dir = await project({ 'a.test.js': `it.skip('x', () => {}); it.todo('y');` });
    const result = await runTests(dir);
    expect(result.status).toBe('failed');
    expect(result.errorMessage).toContain('skipped');
  });

  it('writes nothing into the folder under test', async () => {
    const dir = await project({ 'a.test.js': `it('ok', () => {});` });
    await runTests(dir);
    expect((await readdir(dir)).sort()).toEqual(['a.test.js', 'package.json']);
  });

  it('kills an infinite loop after the timeout', async () => {
    const dir = await project({ 'loop.test.js': `it('hangs', () => { while (true) {} });` });
    const result = await runTests(dir, { timeoutMs: 3000 });
    expect(result.status).toBe('timeout');
    expect(result.errorMessage).toContain('timed out');
  }, 20_000);
});
