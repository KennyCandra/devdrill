import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SaveFileRequest } from '@bughunt/shared';
import { ApiRequestError } from '../api/client';
import { FileStore, type FileApi } from './fileStore';

/** A fake server with one file whose mtime goes up on every save. */
function fakeApi(opts: { saveDelayMs?: number } = {}) {
  const disk = { content: 'v0', mtimeMs: 100 };
  const saves: SaveFileRequest[] = [];
  const api: FileApi = {
    read: (path) => Promise.resolve({ path, content: disk.content, mtimeMs: disk.mtimeMs }),
    save: async (path, body) => {
      saves.push(body);
      if (opts.saveDelayMs) await new Promise((r) => setTimeout(r, opts.saveDelayMs));
      if (body.baseMtimeMs !== undefined && body.baseMtimeMs !== disk.mtimeMs) {
        throw new ApiRequestError(409, 'changed');
      }
      disk.content = body.content;
      disk.mtimeMs += 1;
      return { path, size: body.content.length, mtimeMs: disk.mtimeMs };
    },
  };
  return { api, disk, saves };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('FileStore', () => {
  it('autosaves after the delay', async () => {
    const { api, disk } = fakeApi();
    const store = new FileStore(api, 600);
    await store.load('a.js');
    store.edit('a.js', 'v1');
    expect(store.get('a.js')?.state).toBe('dirty');
    await vi.advanceTimersByTimeAsync(600);
    expect(disk.content).toBe('v1');
    expect(store.get('a.js')?.state).toBe('saved');
  });

  it('never sends a stale base when saves overlap (no false conflict)', async () => {
    const { api, disk, saves } = fakeApi({ saveDelayMs: 1500 });
    const store = new FileStore(api, 600);
    await store.load('a.js');

    store.edit('a.js', 'v1');
    await vi.advanceTimersByTimeAsync(800); // autosave in flight
    store.edit('a.js', 'v2');
    const flushed = store.flush(); // Cmd+S while the first save is still running
    await vi.advanceTimersByTimeAsync(5000);
    await flushed;

    expect(store.get('a.js')?.state).toBe('saved');
    expect(disk.content).toBe('v2');
    expect(saves.map((s) => s.baseMtimeMs)).toEqual([100, 101]);
  });

  it('keeps the edit dirty if the user typed while it was saving', async () => {
    const { api } = fakeApi({ saveDelayMs: 100 });
    const store = new FileStore(api, 600);
    await store.load('a.js');
    store.edit('a.js', 'v1');
    void store.save('a.js');
    await vi.advanceTimersByTimeAsync(10); // the save request is now in flight
    store.edit('a.js', 'v12');
    await vi.advanceTimersByTimeAsync(90);
    expect(store.get('a.js')?.state).toBe('dirty');
  });

  it('marks a real conflict and lets the user keep their version', async () => {
    const { api, disk } = fakeApi();
    const store = new FileStore(api, 600);
    await store.load('a.js');
    disk.mtimeMs = 999; // changed in another editor
    store.edit('a.js', 'mine');
    await vi.advanceTimersByTimeAsync(600);
    expect(store.get('a.js')?.state).toBe('conflict');

    // Typing during a conflict does not retry the save.
    store.edit('a.js', 'mine!');
    expect(store.get('a.js')?.state).toBe('conflict');

    await store.save('a.js', { overwrite: true });
    expect(disk.content).toBe('mine!');
    expect(store.get('a.js')?.state).toBe('saved');
  });

  it('loads their version on request', async () => {
    const { api, disk } = fakeApi();
    const store = new FileStore(api, 600);
    await store.load('a.js');
    const before = store.get('a.js')!.diskRevision;
    disk.content = 'theirs';
    await store.load('a.js', { force: true });
    expect(store.get('a.js')).toMatchObject({ content: 'theirs', state: 'saved' });
    expect(store.get('a.js')!.diskRevision).toBe(before + 1);
  });

  it('retries a failed save with backoff', async () => {
    const { api, disk } = fakeApi();
    const realSave = api.save;
    let failures = 2;
    api.save = (path, body) =>
      failures-- > 0 ? Promise.reject(new TypeError('Failed to fetch')) : realSave(path, body);
    const store = new FileStore(api, 600);
    await store.load('a.js');
    store.edit('a.js', 'v1');
    await vi.advanceTimersByTimeAsync(600);
    expect(store.get('a.js')).toMatchObject({ state: 'error' });
    expect(store.get('a.js')?.error).toContain("Can't reach");
    await vi.advanceTimersByTimeAsync(1000 + 2000);
    expect(disk.content).toBe('v1');
    expect(store.get('a.js')?.state).toBe('saved');
  });

  it('clear waits for in-flight saves and forgets every file', async () => {
    const { api, disk } = fakeApi({ saveDelayMs: 100 });
    const store = new FileStore(api, 600);
    await store.load('a.js');
    store.edit('a.js', 'v1');
    void store.save('a.js');
    const cleared = store.clear();
    await vi.advanceTimersByTimeAsync(100);
    await cleared;
    expect(disk.content).toBe('v1');
    expect(store.getSnapshot()).toEqual({});
  });
});
