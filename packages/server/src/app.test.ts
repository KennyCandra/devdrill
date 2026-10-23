import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { request as httpRequest, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type {
  ChallengeDetail,
  ChallengeSummary,
  ReviewComment,
  ReviewDraft,
  ReviewIssue,
  ReviewPullRequest,
  ReviewResult,
  FileContent,
  SavedFile,
  SolutionFile,
  SubmitResult,
  TestRunResult,
  WorkspaceInfo,
} from '@devdrill/shared';
import { createApp } from './app.js';
import { appPaths } from './config.js';
import { TOKEN_HEADER } from './security.js';
import { loadChallenges } from './services/challengeLoader.js';

const TOKEN = 'test-token-0123456789abcdef';
const ID = 'debug-001-cart-discount';
const BUGGY_LINE = "coupon.type === 'percentage'";
const FIXED_LINE = "coupon.type === 'percent'";

let dataDir: string;
let server: Server;
let host: string;

/** A request with everything the security middleware needs; tests remove parts of it. */
function api(method: 'get' | 'post' | 'put' | 'delete', url: string) {
  const req = request(server)[method](`/api${url}`).set('Host', host).set(TOKEN_HEADER, TOKEN);
  return method === 'get' ? req : req.set('Content-Type', 'application/json');
}

async function startServer(): Promise<void> {
  dataDir = await mkdtemp(path.join(tmpdir(), 'devdrill-app-test-'));
  const app = createApp({
    challenges: await loadChallenges(appPaths().challenges),
    dataDir,
    token: TOKEN,
    extraOrigins: ['http://localhost:5173'],
  });
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  host = `127.0.0.1:${(server.address() as AddressInfo).port}`;
}

beforeAll(startServer);

afterAll(async () => {
  server.close();
  await rm(dataDir, { recursive: true, force: true });
});

describe('security', () => {
  it('accepts a correct request', async () => {
    await api('get', '/challenges').expect(200);
  });

  it('rejects a missing token', async () => {
    await request(server).get('/api/challenges').set('Host', host).expect(401);
  });

  it('rejects a wrong token', async () => {
    await api('get', '/challenges').set(TOKEN_HEADER, 'nope').expect(401);
  });

  it('rejects a foreign Host header (DNS rebinding)', async () => {
    await api('get', '/challenges').set('Host', 'evil.example:80').expect(403);
  });

  it('rejects a foreign Origin (CSRF)', async () => {
    await api('get', '/challenges').set('Origin', 'https://evil.example').expect(403);
  });

  it('allows the configured dev origin', async () => {
    await api('get', '/challenges').set('Origin', 'http://localhost:5173').expect(200);
  });

  it('rejects writes that are not JSON', async () => {
    await api('post', `/challenges/${ID}/start`)
      .set('Content-Type', 'text/plain')
      .send('hello')
      .expect(415);
  });

  it('accepts a JSON POST with no body at all (no Content-Length)', async () => {
    const status = await new Promise<number | undefined>((resolve, reject) => {
      const req = httpRequest(
        {
          host: '127.0.0.1',
          port: Number(host.split(':')[1]),
          method: 'POST',
          path: `/api/challenges/${ID}/start`,
          headers: { Host: host, [TOKEN_HEADER]: TOKEN, 'Content-Type': 'application/json' },
        },
        (res) => {
          res.resume();
          resolve(res.statusCode);
        },
      );
      req.on('error', reject);
      req.end();
    });
    expect(status).toBe(200);
  });

  it('answers unknown API routes with a JSON 404', async () => {
    const res = await api('get', '/nope').expect(404);
    expect(res.body).toEqual({ error: 'Unknown API route.' });
  });
});

describe('challenges', () => {
  it('lists challenges without hints', async () => {
    const res = await api('get', '/challenges').expect(200);
    const cart = (res.body as { id: string; hints?: unknown }[]).find((c) => c.id === ID);
    expect(cart).toMatchObject({ id: ID, mode: 'debug', title: expect.any(String) });
    expect(cart).not.toHaveProperty('hints');
  });

  it('returns details with README and hints', async () => {
    const res = await api('get', `/challenges/${ID}`).expect(200);
    expect(res.body).toMatchObject({ id: ID, readme: expect.stringContaining('SAVE10') });
    expect((res.body as { hints: string[] }).hints.length).toBeGreaterThan(0);
  });

  it('404s an unknown challenge', async () => {
    await api('get', '/challenges/nope').expect(404);
  });

  it('returns the solution next to the starter file', async () => {
    const res = await api('get', `/challenges/${ID}/solution`).expect(200);
    const [file] = res.body as SolutionFile[];
    expect(file?.path).toBe('src/discount.js');
    expect(file?.starter).toContain(BUGGY_LINE);
    expect(file?.solution).toContain(FIXED_LINE);
  });
});

describe('workspace flow', () => {
  beforeEach(async () => {
    await api('post', `/challenges/${ID}/start`).expect(200);
    await api('post', `/workspaces/${ID}/reset`).expect(200);
  });

  it('handles two starts at once (React dev mode sends two)', async () => {
    await rm(path.join(dataDir, 'workspaces', 'js', ID), { recursive: true });
    const [a, b] = await Promise.all([
      api('post', `/challenges/${ID}/start`),
      api('post', `/challenges/${ID}/start`),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect((a.body as WorkspaceInfo).files).toEqual((b.body as WorkspaceInfo).files);
  });

  it('needs the challenge to be started first', async () => {
    await rm(path.join(dataDir, 'workspaces', 'js', ID), { recursive: true });
    const res = await api('get', `/workspaces/${ID}`).expect(404);
    expect(res.body).toEqual({ error: 'Start the challenge first.' });
  });

  it('copies the starter files without hidden tests or the solution', async () => {
    const res = await api('get', `/workspaces/${ID}`).expect(200);
    const files = (res.body as WorkspaceInfo).files;
    expect(files).toContain('src/discount.js');
    expect(files).toContain('tests/cart.test.js');
    expect(files.some((f) => f.includes('hidden'))).toBe(false);
  });

  it('solves the challenge end to end: run fails, fix, run passes, submit solves', async () => {
    const before = await api('post', `/workspaces/${ID}/run`).expect(200);
    expect((before.body as TestRunResult).status).toBe('failed');

    const file = await api('get', `/workspaces/${ID}/files?path=src/discount.js`).expect(200);
    const fixed = (file.body as { content: string }).content.replace(BUGGY_LINE, FIXED_LINE);
    await api('put', `/workspaces/${ID}/files?path=src/discount.js`)
      .send({ content: fixed })
      .expect(200);

    const after = await api('post', `/workspaces/${ID}/run`).expect(200);
    expect((after.body as TestRunResult).status).toBe('passed');

    const submit = await api('post', `/workspaces/${ID}/submit`)
      .send({ elapsedMs: 61_000 })
      .expect(200);
    const result = submit.body as SubmitResult;
    expect(result.solved).toBe(true);
    const hidden = result.run.tests.filter((t) => t.hidden);
    expect(hidden.length).toBeGreaterThan(0);
    expect(hidden.every((t) => t.file.endsWith('.hidden.test.js'))).toBe(true);
    expect(result.progress).toMatchObject({ status: 'solved', bestTimeMs: 61_000 });

    // Hidden tests never land in the workspace.
    const ws = await api('get', `/workspaces/${ID}`).expect(200);
    expect((ws.body as WorkspaceInfo).files.some((f) => f.includes('hidden'))).toBe(false);

    // Progress is on disk, so it survives a restart.
    const saved = JSON.parse(await readFile(path.join(dataDir, 'progress.json'), 'utf8')) as {
      challenges: Record<string, { status: string }>;
    };
    expect(saved.challenges[`js:${ID}`]?.status).toBe('solved');
  }, 30_000);

  it('does not solve when only the visible tests pass', async () => {
    // Hardcoding SAVE10 passes the visible test but not the hidden ones.
    const file = await api('get', `/workspaces/${ID}/files?path=src/discount.js`).expect(200);
    const hack = (file.body as { content: string }).content.replace(
      'if (!coupon) {',
      "if (coupon?.code === 'SAVE10') {\n    return Math.round(amountCents / 10);\n  }\n  if (!coupon) {",
    );
    await api('put', `/workspaces/${ID}/files?path=src/discount.js`)
      .send({ content: hack })
      .expect(200);

    expect(((await api('post', `/workspaces/${ID}/run`)).body as TestRunResult).status).toBe(
      'passed',
    );
    const submit = await api('post', `/workspaces/${ID}/submit`).send({}).expect(200);
    expect((submit.body as SubmitResult).solved).toBe(false);
    // Failing hidden tests show only their names until the challenge is solved.
    const hiddenFailures = (submit.body as SubmitResult).run.tests.filter(
      (t) => t.hidden && t.status === 'failed',
    );
    expect(hiddenFailures.length).toBeGreaterThan(0);
    for (const t of hiddenFailures) {
      expect(t.detailsHidden).toBe(true);
      expect(t.message).toBeUndefined();
    }
  }, 30_000);

  it('reset restores the starter code', async () => {
    await api('put', `/workspaces/${ID}/files?path=src/discount.js`)
      .send({ content: 'changed' })
      .expect(200);
    await api('post', `/workspaces/${ID}/reset`).expect(200);
    const file = await api('get', `/workspaces/${ID}/files?path=src/discount.js`).expect(200);
    expect((file.body as { content: string }).content).toContain(BUGGY_LINE);
  });

  it('refuses a second run while one is in progress', async () => {
    const [a, b] = await Promise.all([
      api('post', `/workspaces/${ID}/run`),
      api('post', `/workspaces/${ID}/run`),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
  }, 30_000);

  it.each([
    '../../etc/passwd',
    '..%2F..%2Fetc%2Fpasswd',
    '/etc/passwd',
    'src/../../outside.js',
    'C:\\Windows\\win.ini',
    '',
  ])('blocks the path %j', async (badPath) => {
    await api('get', `/workspaces/${ID}/files?path=${badPath}`).expect(400);
    await api('put', `/workspaces/${ID}/files?path=${badPath}`).send({ content: 'x' }).expect(400);
  });

  it('blocks a symlink that points outside the workspace', async () => {
    const outside = path.join(dataDir, 'secret.txt');
    await writeFile(outside, 'secret');
    await symlink(outside, path.join(dataDir, 'workspaces', 'js', ID, 'link.js'));
    await api('get', `/workspaces/${ID}/files?path=link.js`).expect(400);
    await api('put', `/workspaces/${ID}/files?path=link.js`).send({ content: 'x' }).expect(400);
    expect(await readFile(outside, 'utf8')).toBe('secret');
  });

  it('lets the user create a new file inside the workspace', async () => {
    await mkdir(path.join(dataDir, 'workspaces', 'js', ID, 'src'), { recursive: true });
    await api('put', `/workspaces/${ID}/files?path=src/helpers/new.js`)
      .send({ content: 'export const x = 1;\n' })
      .expect(200);
    const ws = await api('get', `/workspaces/${ID}`).expect(200);
    expect((ws.body as WorkspaceInfo).files).toContain('src/helpers/new.js');
  });

  it('rejects non-string content', async () => {
    await api('put', `/workspaces/${ID}/files?path=src/cart.js`).send({ content: 5 }).expect(400);
  });
});

describe('workspace edge cases', () => {
  const ws = () => path.join(dataDir, 'workspaces', 'js', ID);

  beforeEach(async () => {
    await api('post', `/challenges/${ID}/start`).expect(200);
    await api('post', `/workspaces/${ID}/reset`).expect(200);
  });

  it('ignores a vitest.config.js in the workspace, so hidden tests always run', async () => {
    await api('put', `/workspaces/${ID}/files?path=vitest.config.js`)
      .send({ content: 'export default { test: { include: ["tests/cart.test.js"] } };\n' })
      .expect(200);
    const file = await api('get', `/workspaces/${ID}/files?path=src/discount.js`).expect(200);
    const hack = (file.body as FileContent).content.replace(
      'if (!coupon) {',
      "if (coupon?.code === 'SAVE10') {\n    return Math.round(amountCents / 10);\n  }\n  if (!coupon) {",
    );
    await api('put', `/workspaces/${ID}/files?path=src/discount.js`).send({ content: hack });
    const submit = await api('post', `/workspaces/${ID}/submit`).expect(200);
    const result = submit.body as SubmitResult;
    expect(result.solved).toBe(false);
    expect(result.run.tests.some((t) => t.hidden)).toBe(true);
  }, 30_000);

  it('refuses a save when the file changed since it was loaded', async () => {
    const file = await api('get', `/workspaces/${ID}/files?path=src/cart.js`).expect(200);
    const { mtimeMs, content } = file.body as FileContent;
    const saved = await api('put', `/workspaces/${ID}/files?path=src/cart.js`)
      .send({ content: content + '\n', baseMtimeMs: mtimeMs })
      .expect(200);
    expect((saved.body as SavedFile).size).toBe(Buffer.byteLength(content + '\n'));
    // A second save based on the old version is a conflict.
    await new Promise((r) => setTimeout(r, 20));
    await api('put', `/workspaces/${ID}/files?path=src/cart.js`)
      .send({ content: 'stale', baseMtimeMs: mtimeMs - 1000 })
      .expect(409);
  });

  it('deletes a file', async () => {
    await api('delete', `/workspaces/${ID}/files?path=src/coupons.js`).expect(200);
    const res = await api('get', `/workspaces/${ID}`).expect(200);
    expect((res.body as WorkspaceInfo).files).not.toContain('src/coupons.js');
    await api('delete', `/workspaces/${ID}/files?path=src/coupons.js`).expect(404);
  });

  it.each(['Node_Modules/x.js', 'node_modules./x.js', '.git/config'])(
    'refuses to write into %s',
    async (p) => {
      await api('put', `/workspaces/${ID}/files?path=${p}`).send({ content: 'x' }).expect(400);
    },
  );

  it.each([
    ['src/cart.js/x.js', 400],
    ['src', 400],
    [`${'a'.repeat(300)}.js`, 400],
  ])('answers %s with a clear %i, not a 500', async (p, status) => {
    await api('put', `/workspaces/${ID}/files?path=${p}`).send({ content: 'x' }).expect(status);
  });

  it('refuses to open binary files', async () => {
    await writeFile(path.join(ws(), 'image.png'), Buffer.from([0x89, 0x50, 0x00, 0x01]));
    await api('get', `/workspaces/${ID}/files?path=image.png`).expect(415);
  });

  it('accepts bodyless POSTs with no Content-Type (the token already blocks other sites)', async () => {
    await request(server)
      .post(`/api/workspaces/${ID}/reset`)
      .set('Host', host)
      .set(TOKEN_HEADER, TOKEN)
      .expect(200);
  });

  it('records when a challenge was first started', async () => {
    const res = await api('get', `/challenges/${ID}`).expect(200);
    expect((res.body as ChallengeDetail).progress.startedAt).toEqual(expect.any(String));
  });
});

describe('session', () => {
  it('confirms the token works', async () => {
    const res = await api('get', '/session').expect(200);
    expect(res.body).toMatchObject({ ok: true });
  });
});

describe('settings', () => {
  it('returns defaults and saves valid changes', async () => {
    const res = await api('get', '/settings').expect(200);
    // The timer is on unless the user turns it off.
    expect(res.body).toEqual({ timerEnabled: true, theme: 'system', language: 'js' });
    await api('put', '/settings').send({ timerEnabled: false }).expect(200);
    const after = await api('get', '/settings').expect(200);
    expect(after.body).toEqual({ timerEnabled: false, theme: 'system', language: 'js' });
  });

  it.each([{ timerEnabled: 'yes' }, { theme: 'pink' }, { unknown: 1 }])(
    'rejects %j',
    async (body) => {
      await api('put', '/settings').send(body).expect(400);
    },
  );
});

describe('reset progress', () => {
  it('clears progress and every workspace', async () => {
    await api('post', `/challenges/${ID}/start`).expect(200);
    await api('delete', '/progress').expect(200);
    const res = await api('get', `/challenges/${ID}`).expect(200);
    expect((res.body as ChallengeDetail).progress).toEqual({ status: 'not_started', attempts: 0 });
    await api('get', `/workspaces/${ID}`).expect(404);
  });
});

describe('serving the built UI', () => {
  let uiServer: Server;
  let uiHost: string;
  let uiDir: string;

  beforeAll(async () => {
    uiDir = await mkdtemp(path.join(tmpdir(), 'devdrill-ui-test-'));
    await mkdir(path.join(uiDir, 'assets'));
    await writeFile(path.join(uiDir, 'index.html'), '<!doctype html><title>DevDrill</title>');
    await writeFile(path.join(uiDir, 'assets', 'app-abc123.js'), 'console.log(1);');
    const app = createApp({
      challenges: await loadChallenges(appPaths().challenges),
      dataDir,
      token: TOKEN,
      uiDir,
    });
    uiServer = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => uiServer.once('listening', resolve));
    uiHost = `127.0.0.1:${(uiServer.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    uiServer.close();
    await rm(uiDir, { recursive: true, force: true });
  });

  it('serves the app page with security headers and no token', async () => {
    const res = await request(uiServer).get('/').set('Host', uiHost).expect(200);
    expect(res.text).toContain('<title>DevDrill</title>');
    expect(res.text).not.toContain(TOKEN);
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('serves the app page for app routes', async () => {
    const res = await request(uiServer)
      .get(`/challenge/${ID}/results`)
      .set('Host', uiHost)
      .expect(200);
    expect(res.text).toContain('<title>DevDrill</title>');
  });

  it('serves hashed assets with long caching', async () => {
    const res = await request(uiServer)
      .get('/assets/app-abc123.js')
      .set('Host', uiHost)
      .expect(200);
    expect(res.headers['cache-control']).toContain('immutable');
  });

  it.each(['/assets/old-chunk-123.js', '/nope.js', '/favicon.ico'])(
    'answers a missing file %s with 404, not the app page',
    async (missing) => {
      const res = await request(uiServer).get(missing).set('Host', uiHost).expect(404);
      expect(res.text).not.toContain('<title>');
    },
  );

  it.each([
    '/..%2f..%2fpackage.json',
    '/assets/..%2f..%2fpackage.json',
    '/%2e%2e/%2e%2e/etc/passwd',
  ])('never serves files outside the UI folder: %s', async (attack) => {
    const res = await request(uiServer).get(attack).set('Host', uiHost);
    expect(res.text).not.toContain('"dependencies"');
    expect(res.text).not.toContain('root:');
  });

  it('rejects a foreign Host for the UI too', async () => {
    await request(uiServer).get('/').set('Host', 'evil.example').expect(403);
  });

  it('still answers unknown API routes with JSON', async () => {
    const res = await request(uiServer)
      .get('/api/nope')
      .set('Host', uiHost)
      .set(TOKEN_HEADER, TOKEN)
      .expect(404);
    expect(res.body).toEqual({ error: 'Unknown API route.' });
  });
});

describe('hidden test rules and code', () => {
  it('names the README rule for each hidden test, and unlocks the code after solving', async () => {
    await api('delete', '/progress').expect(200);
    await api('post', `/challenges/${ID}/start`).expect(200);

    const failed = (await api('post', `/workspaces/${ID}/submit`).send({}).expect(200))
      .body as SubmitResult;
    const hidden = failed.run.tests.filter((t) => t.hidden);
    expect(hidden.length).toBeGreaterThan(0);
    expect(hidden.every((t) => typeof t.rule === 'string' && t.rule.length > 0)).toBe(true);
    expect(failed.run.tests.filter((t) => !t.hidden).every((t) => t.rule === undefined)).toBe(true);

    await api('get', `/challenges/${ID}/hidden-tests`).expect(403);

    const file = await api('get', `/workspaces/${ID}/files?path=src/discount.js`).expect(200);
    const fixed = (file.body as FileContent).content.replace(BUGGY_LINE, FIXED_LINE);
    await api('put', `/workspaces/${ID}/files?path=src/discount.js`).send({ content: fixed });
    await api('post', `/workspaces/${ID}/submit`).send({}).expect(200);

    const res = await api('get', `/challenges/${ID}/hidden-tests`).expect(200);
    const files = res.body as FileContent[];
    expect(files[0]?.path).toMatch(/\.hidden\.test\.js$/);
    expect(files[0]?.content).toContain('describe(');
  }, 30_000);

  it('never sends the rules map to the browser', async () => {
    const detail = await api('get', `/challenges/${ID}`).expect(200);
    expect(detail.body).not.toHaveProperty('hiddenTestRules');
    const list = await api('get', '/challenges').expect(200);
    expect((list.body as object[])[0]).not.toHaveProperty('hiddenTestRules');
  });
});

describe('languages', () => {
  it('rejects an unknown language', async () => {
    await api('get', `/challenges?lang=python`).expect(400);
  });

  it('lists the languages each challenge has', async () => {
    const list = await api('get', '/challenges').expect(200);
    const cart = (list.body as { id: string; languages: string[] }[]).find((c) => c.id === ID);
    expect(cart?.languages).toContain('js');
  });

  it('survives an old and a new workspace for the same challenge, keeping both', async () => {
    const home = await mkdtemp(path.join(tmpdir(), 'devdrill-collide-test-'));
    try {
      await mkdir(path.join(home, 'workspaces', ID), { recursive: true });
      await writeFile(path.join(home, 'workspaces', ID, 'old.js'), 'old');
      await mkdir(path.join(home, 'workspaces', 'js', ID), { recursive: true });
      await writeFile(path.join(home, 'workspaces', 'js', ID, 'new.js'), 'new');
      await writeFile(
        path.join(home, 'progress.json'),
        JSON.stringify({
          challenges: {
            [`js:${ID}`]: { status: 'solved', attempts: 3 },
            [ID]: { status: 'in_progress', attempts: 1 },
          },
        }),
      );
      const app = createApp({
        challenges: await loadChallenges(appPaths().challenges),
        dataDir: home,
        token: TOKEN,
      });
      const srv = app.listen(0, '127.0.0.1');
      await new Promise((resolve) => srv.once('listening', resolve));
      const host2 = `127.0.0.1:${(srv.address() as AddressInfo).port}`;
      const get = (url: string) =>
        request(srv).get(`/api${url}`).set('Host', host2).set(TOKEN_HEADER, TOKEN);

      const ws = await get(`/workspaces/${ID}?lang=js`).expect(200);
      expect((ws.body as WorkspaceInfo).files).toEqual(['new.js']);
      // Other challenges keep working too.
      await get('/challenges').expect(200);
      // The newer progress entry wins, wherever it is in the file.
      const detail = await get(`/challenges/${ID}?lang=js`).expect(200);
      expect((detail.body as ChallengeDetail).progress).toMatchObject({ attempts: 3 });
      // Nothing was deleted.
      expect(await readFile(path.join(home, 'workspaces', ID, 'old.js'), 'utf8')).toBe('old');
      srv.close();
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it('moves workspaces and progress from before languages into JavaScript', async () => {
    const oldHome = await mkdtemp(path.join(tmpdir(), 'devdrill-migrate-test-'));
    try {
      await mkdir(path.join(oldHome, 'workspaces', ID, 'src'), { recursive: true });
      await writeFile(path.join(oldHome, 'workspaces', ID, 'src', 'mine.js'), '// my work');
      await writeFile(
        path.join(oldHome, 'progress.json'),
        JSON.stringify({ challenges: { [ID]: { status: 'solved', attempts: 2 } } }),
      );
      const app = createApp({
        challenges: await loadChallenges(appPaths().challenges),
        dataDir: oldHome,
        token: TOKEN,
      });
      const old = app.listen(0, '127.0.0.1');
      await new Promise((resolve) => old.once('listening', resolve));
      const oldHost = `127.0.0.1:${(old.address() as AddressInfo).port}`;
      const get = (url: string) =>
        request(old).get(`/api${url}`).set('Host', oldHost).set(TOKEN_HEADER, TOKEN);

      const ws = await get(`/workspaces/${ID}?lang=js`).expect(200);
      expect((ws.body as WorkspaceInfo).files).toContain('src/mine.js');
      const detail = await get(`/challenges/${ID}?lang=js`).expect(200);
      expect((detail.body as ChallengeDetail).progress).toMatchObject({ status: 'solved' });
      old.close();
    } finally {
      await rm(oldHome, { recursive: true, force: true });
    }
  });
});

describe('review challenges', () => {
  const REVIEW = 'review-001-order-coupons';
  const MUST: ReviewComment = {
    id: 'c1',
    file: 'src/orders.js',
    lines: [20, 20],
    type: 'mutates-shared-state',
    why: 'It changes the prices of the order the cart still shows.',
  };
  const saveDraft = (draft: ReviewDraft, lang = 'js') =>
    api('put', `/workspaces/${REVIEW}/review?lang=${lang}`).send(draft);

  beforeEach(async () => {
    await api('post', `/challenges/${REVIEW}/start?lang=js`).expect(200);
    await api('post', `/workspaces/${REVIEW}/reset?lang=js`).expect(200);
  });

  it('is listed as a review', async () => {
    const res = await api('get', '/challenges').expect(200);
    const review = (res.body as ChallengeSummary[]).find((c) => c.id === REVIEW);
    expect(review).toMatchObject({ mode: 'review', languages: ['js', 'ts'] });
  });

  it('serves the pull request: changed files, before and after, and the issue types', async () => {
    const res = await api('get', `/challenges/${REVIEW}/review?lang=ts`).expect(200);
    const pr = res.body as ReviewPullRequest;
    expect(pr.files.map((f) => f.path)).toEqual(['src/orders.ts', 'tests/orders.test.ts']);
    expect(pr.files[0]?.base).toContain('export function orderTotal');
    expect(pr.files[0]?.head).toContain('export function applyCoupon');
    expect(pr.issueTypes.map((t) => t.id)).toContain('unsafe-type-assertion');
  });

  it("doesn't put the answer key in the challenge details", async () => {
    const res = await api('get', `/challenges/${REVIEW}?lang=js`).expect(200);
    expect(JSON.stringify(res.body)).not.toContain('coupon-mutates-order');
  });

  it('has no code to edit or tests to run', async () => {
    await api('post', `/workspaces/${REVIEW}/run?lang=js`).expect(400);
    await api('post', `/workspaces/${REVIEW}/submit?lang=js`).expect(400);
    await api('get', `/workspaces/${REVIEW}/files?lang=js&path=review.json`).expect(400);
    await api('get', `/challenges/${REVIEW}/solution?lang=js`).expect(400);
  });

  it('starts with an empty draft and saves one', async () => {
    const empty = await api('get', `/workspaces/${REVIEW}/review?lang=js`).expect(200);
    expect(empty.body).toEqual({ comments: [], verdict: null });
    await saveDraft({ comments: [MUST], verdict: 'request_changes' }).expect(200);
    const saved = await api('get', `/workspaces/${REVIEW}/review?lang=js`).expect(200);
    expect((saved.body as ReviewDraft).comments).toHaveLength(1);
  });

  it('rejects comments outside the pull request, and more than 7', async () => {
    await saveDraft({ comments: [{ ...MUST, file: 'src/other.js' }], verdict: null }).expect(400);
    await saveDraft({ comments: [{ ...MUST, lines: [20, 999] }], verdict: null }).expect(400);
    await saveDraft({ comments: [{ ...MUST, type: 'made-up' }], verdict: null }).expect(400);
    await saveDraft({ comments: [{ ...MUST, why: '  ' }], verdict: null }).expect(400);
    const eight = Array.from({ length: 8 }, (_, i) => ({ ...MUST, id: `c${i}` }));
    await saveDraft({ comments: eight, verdict: null }).expect(400);
  });

  it('needs a verdict to submit', async () => {
    await saveDraft({ comments: [MUST], verdict: null }).expect(200);
    await api('post', `/workspaces/${REVIEW}/review/submit?lang=js`).send({}).expect(400);
  });

  it('solves the review when the must is found and changes are requested', async () => {
    await saveDraft({ comments: [MUST], verdict: 'request_changes' }).expect(200);
    const res = await api('post', `/workspaces/${REVIEW}/review/submit?lang=js`)
      .send({ elapsedMs: 60_000 })
      .expect(200);
    const result = res.body as ReviewResult;
    expect(result.solved).toBe(true);
    expect(result.progress).toMatchObject({ status: 'solved', bestTimeMs: 60_000 });
    expect(result.issues.every((i) => i.details)).toBe(true);
  });

  it('keeps where and what of missed issues hidden until solved', async () => {
    await api('post', `/workspaces/${REVIEW}/review/submit?lang=ts`).send({}).expect(404); // not started
    // TypeScript is unsolved here (JavaScript was solved above, which reveals everything).
    await api('post', `/challenges/${REVIEW}/start?lang=ts`).expect(200);
    await saveDraft({ comments: [], verdict: 'approve' }, 'ts').expect(200);
    const res = await api('post', `/workspaces/${REVIEW}/review/submit?lang=ts`).send({});
    const result = res.body as ReviewResult;
    expect(result.solved).toBe(false);
    expect(result.verdict.correct).toBe(false);
    expect(result.issues.map((i) => i.details)).toEqual([undefined, undefined, undefined]);
    expect(JSON.stringify(result)).not.toContain('coupon');
  });

  it('serves the answer key', async () => {
    const res = await api('get', `/challenges/${REVIEW}/answer-key?lang=js`).expect(200);
    expect((res.body as ReviewIssue[]).map((i) => i.id)).toContain('coupon-mutates-order');
  });

  it('clears the draft on reset', async () => {
    await saveDraft({ comments: [MUST], verdict: 'approve' }).expect(200);
    await api('post', `/workspaces/${REVIEW}/reset?lang=js`).expect(200);
    const res = await api('get', `/workspaces/${REVIEW}/review?lang=js`).expect(200);
    expect(res.body).toEqual({ comments: [], verdict: null });
  });

  it('refuses the review routes for a debug challenge', async () => {
    await api('get', `/challenges/${ID}/review?lang=js`).expect(400);
    await api('get', `/challenges/${ID}/answer-key?lang=js`).expect(400);
  });

  it('checks every part of a comment', async () => {
    const bad: Partial<ReviewComment>[] = [
      { lines: [1, 41] },
      { lines: [0, 1] },
      { why: 'x'.repeat(1001) },
      { id: 'has spaces' },
    ];
    for (const change of bad) {
      await saveDraft({ comments: [{ ...MUST, ...change }], verdict: null }).expect(400);
    }
    await saveDraft({ comments: [MUST, MUST], verdict: null }).expect(400); // same id
    await api('put', `/workspaces/${REVIEW}/review?lang=js`)
      .send({ comments: [], verdict: 'merge' })
      .expect(400);
  });

  it('starts over when the saved review was edited into something invalid', async () => {
    await saveDraft({ comments: [MUST], verdict: 'approve' }).expect(200);
    const file = path.join(dataDir, 'workspaces', 'js', REVIEW, 'review.json');
    await writeFile(
      file,
      JSON.stringify({ comments: [{ ...MUST, lines: [1, 900] }], verdict: null }),
    );
    // A new server reads the file again (this one has it cached).
    const app = createApp({
      challenges: await loadChallenges(appPaths().challenges),
      dataDir,
      token: TOKEN,
    });
    const other = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => other.once('listening', resolve));
    const otherHost = `127.0.0.1:${(other.address() as AddressInfo).port}`;
    const res = await request(other)
      .get(`/api/workspaces/${REVIEW}/review?lang=js`)
      .set('Host', otherHost)
      .set(TOKEN_HEADER, TOKEN)
      .expect(200);
    other.close();
    expect(res.body).toEqual({ comments: [], verdict: null });
  });

  it('counts attempts and keeps the solved status', async () => {
    const before = (await api('get', `/challenges/${REVIEW}?lang=js`)).body as ChallengeDetail;
    await saveDraft({ comments: [], verdict: 'approve' }).expect(200);
    const res = await api('post', `/workspaces/${REVIEW}/review/submit?lang=js`).send({});
    const result = res.body as ReviewResult;
    expect(result.progress.attempts).toBe(before.progress.attempts + 1);
    expect(result.progress.status).not.toBe('not_started');
  });

  it('forgets drafts on "Reset progress"', async () => {
    await saveDraft({ comments: [MUST], verdict: 'approve' }).expect(200);
    await api('delete', '/progress').expect(200);
    await api('post', `/challenges/${REVIEW}/start?lang=js`).expect(200);
    const res = await api('get', `/workspaces/${REVIEW}/review?lang=js`).expect(200);
    expect(res.body).toEqual({ comments: [], verdict: null });
  });

  it('shows no files in a review workspace', async () => {
    const res = await api('get', `/workspaces/${REVIEW}?lang=js`).expect(200);
    expect((res.body as WorkspaceInfo).files).toEqual([]);
  });
});
