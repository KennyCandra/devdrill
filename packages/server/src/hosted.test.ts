import { mkdtemp, rm } from 'node:fs/promises';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { appPaths, hostedConfig } from './config.js';
import { TOKEN_HEADER } from './security.js';
import { loadChallenges } from './services/challengeLoader.js';

const TOKEN = 'a-very-long-hosted-token-0123456789';
const PUBLIC = 'https://devdrill-ada.up.railway.app';

describe('hostedConfig', () => {
  it('is off without DEVDRILL_PUBLIC_URL', () => {
    expect(hostedConfig({})).toBeNull();
  });

  it('reads the URL, token and port', () => {
    expect(
      hostedConfig({ DEVDRILL_PUBLIC_URL: `${PUBLIC}/`, DEVDRILL_TOKEN: TOKEN, PORT: '8080' }),
    ).toEqual({ publicUrl: PUBLIC, token: TOKEN, port: 8080 });
  });

  it('refuses a missing or guessable token, and a bad URL', () => {
    expect(() => hostedConfig({ DEVDRILL_PUBLIC_URL: PUBLIC })).toThrow('DEVDRILL_TOKEN');
    expect(() => hostedConfig({ DEVDRILL_PUBLIC_URL: PUBLIC, DEVDRILL_TOKEN: 'abc' })).toThrow(
      'DEVDRILL_TOKEN',
    );
    expect(() =>
      hostedConfig({ DEVDRILL_PUBLIC_URL: 'railway.app', DEVDRILL_TOKEN: TOKEN }),
    ).toThrow('full URL');
  });
});

describe('hosted security', () => {
  let dataDir: string;
  let server: Server;

  beforeAll(async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), 'devdrill-hosted-test-'));
    const app = createApp({
      challenges: await loadChallenges(appPaths().challenges),
      dataDir,
      token: TOKEN,
      publicUrl: PUBLIC,
    });
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
  });

  afterAll(async () => {
    server.close();
    await rm(dataDir, { recursive: true, force: true });
  });

  const get = (host: string) =>
    request(server).get('/api/challenges').set('Host', host).set(TOKEN_HEADER, TOKEN);

  it('accepts the public host and origin', async () => {
    await get('devdrill-ada.up.railway.app').set('Origin', PUBLIC).expect(200);
  });

  it('still rejects other hosts, other origins and a missing token', async () => {
    await get('evil.example').expect(403);
    await get('devdrill-ada.up.railway.app').set('Origin', 'https://evil.example').expect(403);
    await request(server)
      .get('/api/challenges')
      .set('Host', 'devdrill-ada.up.railway.app')
      .expect(401);
  });
});
