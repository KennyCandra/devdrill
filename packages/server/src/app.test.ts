import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { request as httpRequest, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type {
  ChallengeDetail,
  FileContent,
  SavedFile,
  SolutionFile,
  SubmitResult,
  TestRunResult,
  WorkspaceInfo,
} from '@bughunt/shared';
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
  dataDir = await mkdtemp(path.join(tmpdir(), 'bughunt-app-test-'));
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
    await rm(path.join(dataDir, 'workspaces', ID), { recursive: true });
    const [a, b] = await Promise.all([
      api('post', `/challenges/${ID}/start`),
      api('post', `/challenges/${ID}/start`),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect((a.body as WorkspaceInfo).files).toEqual((b.body as WorkspaceInfo).files);
  });

  it('needs the challenge to be started first', async () => {
    await rm(path.join(dataDir, 'workspaces', ID), { recursive: true });
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
    expect(saved.challenges[ID]?.status).toBe('solved');
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
    await symlink(outside, path.join(dataDir, 'workspaces', ID, 'link.js'));
    await api('get', `/workspaces/${ID}/files?path=link.js`).expect(400);
    await api('put', `/workspaces/${ID}/files?path=link.js`).send({ content: 'x' }).expect(400);
    expect(await readFile(outside, 'utf8')).toBe('secret');
  });

  it('lets the user create a new file inside the workspace', async () => {
    await mkdir(path.join(dataDir, 'workspaces', ID, 'src'), { recursive: true });
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
  const ws = () => path.join(dataDir, 'workspaces', ID);

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
    expect(res.body).toEqual({ timerEnabled: false, theme: 'system' });
    await api('put', '/settings').send({ timerEnabled: true }).expect(200);
    const after = await api('get', '/settings').expect(200);
    expect(after.body).toEqual({ timerEnabled: true, theme: 'system' });
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
