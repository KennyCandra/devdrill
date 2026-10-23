import type { ReviewComment, ReviewDraft, ReviewVerdict } from '@devdrill/shared';

export type DraftSaveState = 'saved' | 'saving' | 'error';

export interface DraftSnapshot {
  draft: ReviewDraft;
  state: DraftSaveState;
  error: string | null;
}

/**
 * The review being written. Every change is shown at once and saved shortly after
 * (the latest draft wins); `flush()` waits for the save, e.g. before submitting.
 */
export class ReviewDraftStore {
  private snapshot: DraftSnapshot = {
    draft: { comments: [], verdict: null },
    state: 'saved',
    error: null,
  };
  private readonly listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private saving: Promise<void> = Promise.resolve();
  /** Bumped on every change, so a slow save doesn't mark newer changes as saved. */
  private revision = 0;

  constructor(
    private readonly save: (draft: ReviewDraft) => Promise<ReviewDraft>,
    private readonly delayMs = 400,
  ) {}

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): DraftSnapshot => this.snapshot;

  /** The draft from the server; replaces whatever is here without saving it back. */
  load(draft: ReviewDraft): void {
    this.cancelTimer();
    this.revision++;
    this.set({ draft, state: 'saved', error: null });
  }

  addComment(comment: ReviewComment): void {
    this.change((d) => ({ ...d, comments: [...d.comments, comment] }));
  }

  updateComment(comment: ReviewComment): void {
    this.change((d) => ({
      ...d,
      comments: d.comments.map((c) => (c.id === comment.id ? comment : c)),
    }));
  }

  removeComment(id: string): void {
    this.change((d) => ({ ...d, comments: d.comments.filter((c) => c.id !== id) }));
  }

  setVerdict(verdict: ReviewVerdict | null): void {
    this.change((d) => ({ ...d, verdict }));
  }

  /** True while a change hasn't reached the server. */
  isDirty(): boolean {
    return this.snapshot.state !== 'saved';
  }

  /** Saves now if anything is waiting; rejects if the save fails. */
  async flush(): Promise<void> {
    if (this.timer) {
      this.cancelTimer();
      this.startSave();
    }
    await this.saving;
    if (this.snapshot.state === 'error') throw new Error(this.snapshot.error ?? 'Not saved.');
  }

  private change(edit: (draft: ReviewDraft) => ReviewDraft): void {
    this.revision++;
    this.set({ draft: edit(this.snapshot.draft), state: 'saving', error: null });
    this.cancelTimer();
    this.timer = setTimeout(() => {
      this.timer = null;
      this.startSave();
    }, this.delayMs);
  }

  private startSave(): void {
    const revision = this.revision;
    const draft = this.snapshot.draft;
    // Saves run one after another, so an older draft never lands after a newer one.
    this.saving = this.saving.then(async () => {
      try {
        await this.save(draft);
        if (revision === this.revision) this.set({ ...this.snapshot, state: 'saved', error: null });
      } catch (err) {
        if (revision === this.revision) {
          this.set({ ...this.snapshot, state: 'error', error: (err as Error).message });
        }
      }
    });
  }

  private cancelTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private set(next: DraftSnapshot): void {
    this.snapshot = next;
    for (const listener of this.listeners) listener();
  }
}
