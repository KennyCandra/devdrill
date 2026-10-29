import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReviewComment, ReviewDraft } from '@devdrill/shared';
import { ReviewDraftStore } from './reviewDraft';

const comment = (id: string): ReviewComment => ({
  id,
  file: 'src/orders.js',
  lines: [1, 1],
  why: 'Name it.',
});

describe('ReviewDraftStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a change at once and saves it once after a pause', async () => {
    const save = vi.fn((d: ReviewDraft) => Promise.resolve(d));
    const store = new ReviewDraftStore(save, 400);
    store.addComment(comment('a'));
    store.setVerdict('approve');
    expect(store.getSnapshot().draft).toMatchObject({ verdict: 'approve' });
    expect(store.getSnapshot().state).toBe('saving');
    await vi.advanceTimersByTimeAsync(400);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]?.[0]).toEqual({ comments: [comment('a')], verdict: 'approve' });
    expect(store.getSnapshot().state).toBe('saved');
  });

  it('flush saves right away', async () => {
    const save = vi.fn((d: ReviewDraft) => Promise.resolve(d));
    const store = new ReviewDraftStore(save, 400);
    store.addComment(comment('a'));
    await store.flush();
    expect(save).toHaveBeenCalledTimes(1);
    expect(store.isDirty()).toBe(false);
  });

  it('reports a failed save, and flush rejects', async () => {
    const store = new ReviewDraftStore(() => Promise.reject(new Error('offline')), 400);
    store.addComment(comment('a'));
    await expect(store.flush()).rejects.toThrow('offline');
    expect(store.getSnapshot()).toMatchObject({ state: 'error', error: 'offline' });
  });

  it("doesn't mark a newer change saved when an older save finishes", async () => {
    let finish: (() => void) | undefined;
    const save = vi.fn(
      (d: ReviewDraft) =>
        new Promise<ReviewDraft>((resolve) => {
          finish = () => resolve(d);
        }),
    );
    const store = new ReviewDraftStore(save, 400);
    store.addComment(comment('a'));
    await vi.advanceTimersByTimeAsync(400); // first save starts
    store.removeComment('a');
    finish?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getSnapshot().state).toBe('saving');
  });

  it('tries a failed save again on the next flush', async () => {
    let fail = true;
    const save = vi.fn((d: ReviewDraft) =>
      fail ? Promise.reject(new Error('offline')) : Promise.resolve(d),
    );
    const store = new ReviewDraftStore(save, 400);
    store.addComment(comment('a'));
    await expect(store.flush()).rejects.toThrow('offline');
    fail = false;
    await store.flush();
    expect(save).toHaveBeenCalledTimes(2);
    expect(store.getSnapshot().state).toBe('saved');
  });
});
