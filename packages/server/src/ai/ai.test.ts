import { mkdtemp, rm, stat } from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AiSettings, AiTestResult } from '@devdrill/shared';
import { createApp } from '../app.js';
import { appPaths } from '../config.js';
import { TOKEN_HEADER } from '../security.js';
import { loadChallenges } from '../services/challengeLoader.js';
import { AiConfigStore } from './config.js';
import type { AiRequest } from './provider.js';
import { createFakeProvider } from './providers/fake.js';
import { createOllamaProvider } from './providers/ollama.js';
import { createOpenCodeProvider } from './providers/opencode.js';
import { AiService, extractJson, type AiFeature } from './service.js';

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'devdrill-ai-test-'));
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

const ECHO: AiFeature<{ n: number }> = {
  system: 'Count.',
  prompt: 'Say 3.',
  schema: { type: 'object', properties: { n: { type: 'number' } }, required: ['n'] },
  parse: (v) => {
    const n = (v as { n?: unknown }).n;
    if (typeof n !== 'number') throw new Error('bad');
    return { n };
  },
};

describe('AiConfigStore', () => {
  it('never shows a key, only whether one is saved, and keeps the file owner-only', async () => {
    const store = AiConfigStore.inDataDir(path.join(dir, 'config'));
    const saved = await store.update({
      provider: 'claude',
      apiKey: 'sk-ant-secret',
      active: 'claude',
    });
    expect(JSON.stringify(saved)).not.toContain('sk-ant-secret');
    expect(saved).toMatchObject({ active: 'claude', providers: { claude: { hasKey: true } } });
    const mode = (await stat(path.join(dir, 'config', 'ai.json'))).mode & 0o777;
    if (process.platform !== 'win32') expect(mode).toBe(0o600);

    const removed = await store.update({ provider: 'claude', apiKey: null });
    expect(removed.providers.claude.hasKey).toBe(false);
  });

  it("drops a saved key when the server URL changes, so it can't be sent somewhere else", async () => {
    const store = AiConfigStore.inDataDir(path.join(dir, 'moved'));
    await store.update({
      provider: 'custom',
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: 'sk-1',
    });
    // Saving the same URL again (the form always sends it) keeps the key.
    const same = await store.update({ provider: 'custom', baseUrl: 'https://api.deepseek.com/v1' });
    expect(same.providers.custom.hasKey).toBe(true);
    const moved = await store.update({ provider: 'custom', baseUrl: 'https://evil.example/v1' });
    expect(moved.providers.custom.hasKey).toBe(false);
    const both = await store.update({
      provider: 'custom',
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: 'sk-2',
    });
    expect(both.providers.custom.hasKey).toBe(true);
    await expect(
      store.update({ provider: 'custom', baseUrl: 'https://me:pw@host.example/v1' }),
    ).rejects.toThrow('plain URL');
  });

  it('rejects unknown providers, bad URLs and keys with spaces', async () => {
    const store = AiConfigStore.inDataDir(path.join(dir, 'bad'));
    await expect(store.update({ active: 'skynet' })).rejects.toThrow('"active"');
    await expect(store.update({ provider: 'ollama', baseUrl: 'localhost' })).rejects.toThrow(
      'full URL',
    );
    await expect(store.update({ provider: 'ollama', baseUrl: 'file:///etc' })).rejects.toThrow(
      'http',
    );
    await expect(store.update({ provider: 'openai', apiKey: 'two words' })).rejects.toThrow(
      'apiKey',
    );
    await expect(store.update({ model: 'x' })).rejects.toThrow('"provider"');
  });
});

describe('AiService', () => {
  const service = (answer: string) =>
    new AiService(
      AiConfigStore.inDataDir(path.join(dir, 'svc')),
      createFakeProvider(() => answer),
    );

  it('asks for an AI provider when none is chosen', async () => {
    const none = new AiService(AiConfigStore.inDataDir(path.join(dir, 'none')));
    await expect(none.run(ECHO)).rejects.toMatchObject({ status: 409 });
  });

  it('accepts JSON wrapped in Markdown fences, and tells every provider the schema', async () => {
    const fake = createFakeProvider(() => 'Sure!\n```json\n{"n": 3}\n```');
    const ai = new AiService(AiConfigStore.inDataDir(path.join(dir, 'fenced')), fake);
    await expect(ai.run(ECHO)).resolves.toEqual({ n: 3 });
    expect(fake.requests[0]?.system).toContain('"required":["n"]');
  });

  it('turns a nonsense answer into a clear 502', async () => {
    await expect(service('no json here').run(ECHO)).rejects.toMatchObject({ status: 502 });
    await expect(service('{"n": "three"}').run(ECHO)).rejects.toMatchObject({ status: 502 });
  });

  it('extracts the JSON object from around it', () => {
    expect(extractJson('x {"a": {"b": 1}} y')).toBe('{"a": {"b": 1}}');
    expect(() => extractJson('nothing')).toThrow();
  });

  it('skips think blocks, braces in prose and braces inside strings', () => {
    const answer =
      '<think>maybe {"n": 0}?</think>Use {braces} like this: {"n": 3, "s": "a } b"} ok';
    expect(JSON.parse(extractJson(answer))).toEqual({ n: 3, s: 'a } b' });
  });

  it('shows the AI buttons only when the chosen provider is set up', async () => {
    const store = AiConfigStore.inDataDir(path.join(dir, 'enabled'));
    const ai = new AiService(store);
    expect(await ai.enabled()).toBe(false);
    await store.update({ active: 'claude' }); // no key yet
    expect(await ai.enabled()).toBe(false);
    await store.update({ provider: 'claude', apiKey: 'sk-ant-x' });
    expect(await ai.enabled()).toBe(true);
  });
});

/** A tiny HTTP server standing in for Ollama or OpenCode; records what it was sent. */
async function fakeHttp(reply: (req: IncomingMessage, body: unknown) => unknown): Promise<{
  url: string;
  seen: { url: string; body: unknown; auth?: string }[];
  close: () => void;
}> {
  const seen: { url: string; body: unknown; auth?: string }[] = [];
  const server: Server = createServer((req, res) => {
    let raw = '';
    req.on('data', (c: Buffer) => (raw += c.toString()));
    req.on('end', () => {
      const body: unknown = raw ? JSON.parse(raw) : undefined;
      seen.push({ url: req.url ?? '', body, auth: req.headers.authorization });
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(reply(req, body)));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}`, seen, close: () => server.close() };
}

const REQUEST = (): AiRequest => ({
  system: 'sys',
  prompt: 'hi',
  schema: { type: 'object' },
  signal: AbortSignal.timeout(5000),
});

describe('Ollama provider', () => {
  it("sends the schema as Ollama's format and returns the message", async () => {
    const http = await fakeHttp(() => ({ message: { content: '{"ok":true}' } }));
    try {
      const ollama = createOllamaProvider({ model: 'qwen3', baseUrl: http.url, apiKey: null });
      await expect(ollama.complete(REQUEST())).resolves.toBe('{"ok":true}');
      expect(http.seen[0]).toMatchObject({
        url: '/api/chat',
        body: { model: 'qwen3', stream: false, format: { type: 'object' } },
      });
    } finally {
      http.close();
    }
  });
});

describe('OpenCode provider', () => {
  it('opens a session, switches tools off, and reads the structured answer', async () => {
    const http = await fakeHttp((req) =>
      req.url === '/session' ? { id: 'ses_1' } : { info: { structured: { ok: true } }, parts: [] },
    );
    try {
      const opencode = createOpenCodeProvider({
        model: 'deepseek/deepseek-chat',
        baseUrl: http.url,
        apiKey: 'pw',
      });
      await expect(opencode.complete(REQUEST())).resolves.toBe('{"ok":true}');
      const message = http.seen[1];
      expect(message?.url).toBe('/session/ses_1/message');
      expect(message?.auth).toBe(`Basic ${Buffer.from('opencode:pw').toString('base64')}`);
      expect(message?.body).toMatchObject({
        model: { providerID: 'deepseek', modelID: 'deepseek-chat' },
        tools: { bash: false, edit: false, write: false },
        format: { type: 'json_schema' },
      });
    } finally {
      http.close();
    }
  });

  it('explains a server that is not running', async () => {
    const opencode = createOpenCodeProvider({
      model: 'default',
      baseUrl: 'http://127.0.0.1:1',
      apiKey: null,
    });
    await expect(opencode.complete(REQUEST())).rejects.toThrow('Is it running?');
  });
});

describe('AI routes', () => {
  it('keeps keys out of responses and tests the connection', async () => {
    const dataDir = await mkdtemp(path.join(tmpdir(), 'devdrill-ai-app-'));
    const app = createApp({
      challenges: await loadChallenges(appPaths().challenges),
      dataDir,
      token: 'test-token-0123456789abcdef',
      aiProvider: createFakeProvider(() => '{"reply":"ready"}'),
    });
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const host = `127.0.0.1:${(server.address() as AddressInfo).port}`;
    const call = (method: 'get' | 'put' | 'post', url: string) => {
      const agent = request(server);
      return agent[method](`/api${url}`)
        .set('Host', host)
        .set(TOKEN_HEADER, 'test-token-0123456789abcdef');
    };
    try {
      const put = await call('put', '/ai/settings')
        .send({ provider: 'openai', apiKey: 'sk-very-secret', active: 'openai' })
        .expect(200);
      expect(JSON.stringify(put.body)).not.toContain('sk-very-secret');
      const get = await call('get', '/ai/settings').expect(200);
      expect((get.body as AiSettings).providers.openai.hasKey).toBe(true);
      expect((get.body as AiSettings).available.map((p) => p.id)).toEqual([
        'claude',
        'openai',
        'ollama',
        'opencode',
        'custom',
      ]);
      const test = await call('post', '/ai/test').send({}).expect(200);
      expect(test.body as AiTestResult).toMatchObject({ ok: true });
      await call('put', '/ai/settings').send({ active: 'nope' }).expect(400);
    } finally {
      server.close();
      await rm(dataDir, { recursive: true, force: true });
    }
  });
});
