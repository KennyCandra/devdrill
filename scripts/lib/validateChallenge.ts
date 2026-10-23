import { cp, lstat, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { init as initLexer, parse as parseImports } from 'es-module-lexer';
import type { ChallengeMeta, TestRunResult } from '@devdrill/shared';
import { parseChallengeMeta } from '../../packages/server/src/services/challengeMeta.js';
import { IGNORED_FILES } from '../../packages/server/src/services/files.js';
import { runTests } from '../../packages/server/src/services/testRunner.js';

export interface ValidationResult {
  dir: string;
  ok: boolean;
  errors: string[];
}

const JS_FILE = /\.m?js$/;
/** Source files that are not plain JS (rule 1). */
const NON_JS_SOURCE = /\.(?:ts|tsx|jsx|mts|cts|cjs)$/;
/** Anything Vitest would pick up as a test file by default. */
const TEST_LIKE_FILE = /\.(?:test|spec)\.[cm]?[jt]sx?$/;
const HIDDEN_TEST_FILE = /\.hidden\.test\.m?js$/;
/** Config files could change which tests run, so challenges can't have them. */
const CONFIG_FILE = /(?:^|\/)(?:vitest|vite)\.(?:config|workspace)\.[cm]?[jt]s$/;
/** Tests that are skipped or focused would let a challenge pass without running everything. */
const SKIP_OR_FOCUS = /\b(?:describe|suite|it|test)\s*\.\s*(?:skip|only|todo|skipIf|runIf)\b/;

type Layer = 'starter' | 'hidden-tests' | 'solution';

/**
 * Checks one challenge folder against the rules listed in CONTRIBUTING.md ("Validate").
 * Runs the tests, so it takes a few seconds per challenge.
 */
export async function validateChallenge(dir: string): Promise<ValidationResult> {
  const errors: string[] = [];
  const done = (): ValidationResult => ({ dir, ok: errors.length === 0, errors });

  // Metadata and README.
  const meta = await readMeta(dir, errors);
  const readme = await readText(path.join(dir, 'README.md'));
  if (!readme?.trim()) {
    errors.push('README.md is missing or empty.');
  } else if (!/```(?:js|javascript)\n/.test(readme)) {
    // Playtesting showed rules written only in prose get missed; an example doesn't.
    errors.push('README.md needs an example of the exact result in a ```js code block.');
  }
  if (readme?.trim() && !/^## Data$/m.test(readme)) {
    // Plain JS has no types; the README is where players learn each object's shape.
    errors.push('README.md needs a "## Data" section describing every object and function.');
  }

  const roots: Record<Layer, string> = {
    starter: path.join(dir, 'starter'),
    'hidden-tests': path.join(dir, 'hidden-tests'),
    solution: path.join(dir, 'solution'),
  };
  const files = {} as Record<Layer, string[]>;
  for (const layer of Object.keys(roots) as Layer[]) {
    const listed = await listFiles(roots[layer], layer, errors);
    if (listed) files[layer] = listed;
  }
  if (errors.length > 0 || !meta) return done();

  // Plain JavaScript, no dependencies.
  await checkPackageJson(roots.starter, errors);
  await initLexer();
  for (const layer of Object.keys(roots) as Layer[]) {
    for (const file of files[layer]) {
      const label = `${layer}/${file}`;
      if (NON_JS_SOURCE.test(file)) errors.push(`${label}: only plain .js files are allowed.`);
      if (CONFIG_FILE.test(file)) errors.push(`${label}: config files are not allowed.`);
      if (!JS_FILE.test(file)) continue;

      const source = await readFile(path.join(roots[layer], file), 'utf8');
      checkImports(label, source, errors);
      if (TEST_LIKE_FILE.test(file) && SKIP_OR_FOCUS.test(source)) {
        errors.push(`${label}: remove .skip/.only/.todo; every test must run.`);
      }
    }
  }

  // Layout rules that keep visible, hidden and solution files apart.
  if (!files.starter.some((f) => TEST_LIKE_FILE.test(f))) {
    errors.push('starter/ has no visible tests (*.test.js).');
  }
  if (files['hidden-tests'].length === 0) errors.push('hidden-tests/ is empty.');
  for (const f of files['hidden-tests']) {
    if (!HIDDEN_TEST_FILE.test(f)) {
      errors.push(`hidden-tests/${f}: only *.hidden.test.js files are allowed here.`);
    }
    if (files.starter.includes(f)) errors.push(`hidden-tests/${f} would overwrite a starter file.`);
  }
  if (files.solution.length === 0) errors.push('solution/ is empty.');
  for (const f of files.solution) {
    if (TEST_LIKE_FILE.test(f)) errors.push(`solution/${f}: the solution must not change tests.`);
    if (path.basename(f) === 'package.json') {
      errors.push(`solution/${f}: the solution must not change package.json.`);
    }
  }
  if (errors.length > 0) return done();

  // Debug / feature behaviour: run the tests.
  const onStarter = await runLayers([roots.starter, roots['hidden-tests']]);
  const onSolution = await runLayers([roots.starter, roots.solution, roots['hidden-tests']]);
  const hiddenFiles = new Set(files['hidden-tests']);
  checkBehaviour(meta, onStarter, onSolution, hiddenFiles, errors);
  checkHiddenTestRules(meta, readme ?? '', onStarter, hiddenFiles, errors);

  return done();
}

async function readMeta(dir: string, errors: string[]): Promise<ChallengeMeta | null> {
  const text = await readText(path.join(dir, 'challenge.json'));
  if (text === null) {
    errors.push('challenge.json is missing.');
    return null;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    errors.push('challenge.json is not valid JSON.');
    return null;
  }
  const result = parseChallengeMeta(raw, {
    mode: path.basename(path.dirname(dir)),
    dirName: path.basename(dir),
  });
  if (!result.ok) {
    errors.push(...result.errors.map((e) => `challenge.json: ${e}`));
    return null;
  }
  return result.meta;
}

async function checkPackageJson(starter: string, errors: string[]): Promise<void> {
  const text = await readText(path.join(starter, 'package.json'));
  if (text === null) {
    errors.push('starter/package.json is missing (it needs "type": "module").');
    return;
  }
  try {
    const pkg = JSON.parse(text) as Record<string, unknown>;
    if (pkg.type !== 'module') errors.push('starter/package.json must set "type": "module".');
    for (const key of [
      'dependencies',
      'devDependencies',
      'peerDependencies',
      'optionalDependencies',
    ]) {
      if (key in pkg) {
        errors.push(`starter/package.json must not have "${key}" (zero dependencies).`);
      }
    }
  } catch {
    errors.push('starter/package.json is not valid JSON.');
  }
}

function checkImports(label: string, source: string, errors: string[]): void {
  let imports;
  try {
    [imports] = parseImports(source, label);
  } catch {
    errors.push(`${label}: could not be parsed as a JavaScript module.`);
    return;
  }

  for (const imp of imports) {
    if (imp.type !== 'static' && imp.type !== 'reexport-star' && imp.type !== 'dynamic') continue;
    if (imp.type === 'dynamic' && imp.glob) {
      errors.push(`${label}: dynamic import() must use a plain string path.`);
      continue;
    }
    const specifier = imp.specifier;
    if (specifier === undefined) continue;
    if (
      specifier.startsWith('./') ||
      specifier.startsWith('../') ||
      specifier.startsWith('node:')
    ) {
      continue;
    }
    errors.push(
      specifier === 'vitest'
        ? `${label}: don't import from "vitest"; describe/it/expect are globals.`
        : `${label}: imports "${specifier}"; only relative and node: imports are allowed.`,
    );
  }

  // createRequire() would let a challenge load packages without an import.
  if (/\bcreateRequire\b/.test(source)) {
    errors.push(`${label}: createRequire is not allowed; use import.`);
  }
}

/**
 * Every hidden test must name the README sentence it checks, and that sentence must
 * really be in the README. So a hidden test can never check a rule the task doesn't
 * state, and a failing one can point the player at the rule they missed.
 */
function checkHiddenTestRules(
  meta: ChallengeMeta,
  readme: string,
  onStarter: TestRunResult,
  hiddenFiles: Set<string>,
  errors: string[],
): void {
  const rules = meta.hiddenTestRules ?? {};
  const hiddenNames = new Set(
    onStarter.tests.filter((t) => hiddenFiles.has(t.file)).map((t) => t.name),
  );
  const text = plainText(readme);

  for (const name of hiddenNames) {
    if (!(name in rules)) {
      errors.push(`hiddenTestRules: add the README sentence that hidden test "${name}" checks.`);
    }
  }
  for (const [name, rule] of Object.entries(rules)) {
    if (!hiddenNames.has(name)) {
      errors.push(`hiddenTestRules: "${name}" isn't a hidden test (names are "describe > test").`);
    } else if (!text.includes(plainText(rule))) {
      errors.push(`hiddenTestRules: the rule for "${name}" isn't in README.md: "${rule}"`);
    }
  }
}

/** README text without Markdown emphasis or code ticks, with whitespace collapsed. */
function plainText(markdown: string): string {
  return markdown
    .replace(/\*\*|`/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function checkBehaviour(
  meta: ChallengeMeta,
  onStarter: TestRunResult,
  onSolution: TestRunResult,
  hiddenFiles: Set<string>,
  errors: string[],
): void {
  for (const [label, run] of [
    ['starter', onStarter],
    ['solution', onSolution],
  ] as const) {
    if (run.status === 'timeout' || run.status === 'error') {
      errors.push(`Tests on ${label} could not run: ${run.errorMessage ?? run.status}`);
    }
    for (const fe of run.fileErrors) {
      errors.push(
        `Test file ${fe.file} failed outside a test on ${label}: ${firstLine(fe.message)}`,
      );
    }
  }
  if (errors.length > 0) return;

  const isHidden = (file: string) => hiddenFiles.has(file);
  const visibleFailures = onStarter.tests.filter((t) => t.status === 'failed' && !isHidden(t.file));
  const hiddenFailures = onStarter.tests.filter((t) => t.status === 'failed' && isHidden(t.file));

  if (meta.mode === 'debug') {
    if (visibleFailures.length === 0) {
      errors.push('Debug rule: at least one visible test must fail on starter/.');
    }
  } else if (visibleFailures.length > 0) {
    errors.push(
      `Feature rule: existing (visible) tests must pass on starter/, but ${visibleFailures.length} failed: ` +
        visibleFailures.map((t) => t.name).join('; '),
    );
  }
  if (hiddenFailures.length === 0) {
    errors.push('At least one hidden test must fail on starter/.');
  }

  // The solution run must run exactly the same tests, and every one must pass.
  const key = (t: { file: string; name: string }) => `${t.file} :: ${t.name}`;
  const starterTests = new Set(onStarter.tests.map(key));
  const solutionTests = new Set(onSolution.tests.map(key));
  const missing = [...starterTests].filter((k) => !solutionTests.has(k));
  const extra = [...solutionTests].filter((k) => !starterTests.has(k));
  if (missing.length > 0 || extra.length > 0) {
    errors.push(
      'The solution run must run the same tests as the starter run. ' +
        [...missing.map((k) => `missing: ${k}`), ...extra.map((k) => `extra: ${k}`)].join('; '),
    );
  }

  const notPassing = onSolution.tests.filter((t) => t.status !== 'passed');
  if (onSolution.status !== 'passed' || notPassing.length > 0) {
    errors.push(
      `All tests must pass on solution/, but ${notPassing.length} did not: ` +
        notPassing.map((t) => `${t.name} (${firstLine(t.message ?? t.status)})`).join('; ') +
        (onSolution.errorMessage ? ` ${firstLine(onSolution.errorMessage)}` : ''),
    );
  }
}

/** Copies each folder on top of the previous one into a temp folder, then runs the tests. */
async function runLayers(layers: string[]): Promise<TestRunResult> {
  const work = await mkdtemp(path.join(tmpdir(), 'devdrill-validate-'));
  try {
    for (const layer of layers) {
      await cp(layer, work, {
        recursive: true,
        force: true,
        filter: (src) => !IGNORED_FILES.has(path.basename(src)),
      });
    }
    return await runTests(work);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

/**
 * All regular files under `root`, relative, with `/` separators.
 * Returns null (and records an error) if the folder is missing or holds
 * anything other than files and folders, such as symlinks.
 */
async function listFiles(root: string, layer: Layer, errors: string[]): Promise<string[] | null> {
  try {
    if (!(await lstat(root)).isDirectory()) throw new Error('not a folder');
  } catch {
    errors.push(`${layer}/ folder is missing.`);
    return null;
  }

  const files: string[] = [];
  let ok = true;
  for (const entry of await readdir(root, { recursive: true, withFileTypes: true })) {
    if (IGNORED_FILES.has(entry.name)) continue;
    const rel = path
      .relative(root, path.join(entry.parentPath, entry.name))
      .split(path.sep)
      .join('/');
    if (rel.split('/').includes('node_modules')) {
      errors.push(`${layer}/${rel}: node_modules is not allowed.`);
      ok = false;
    } else if (entry.isFile()) {
      files.push(rel);
    } else if (!entry.isDirectory()) {
      errors.push(`${layer}/${rel}: only regular files and folders are allowed (no symlinks).`);
      ok = false;
    }
  }
  return ok ? files.sort() : null;
}

async function readText(file: string): Promise<string | null> {
  try {
    return await readFile(file, 'utf8');
  } catch {
    return null;
  }
}

function firstLine(text: string): string {
  return text.split('\n')[0] ?? '';
}
