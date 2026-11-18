export interface User {
  id: number;
  name: string;
  token: string;
}
//T
export interface Settings {
  theme: string;
  newestFirst: boolean;
  maxNoteLength: number;
}
//T
export interface Note {
  id: number;
  ownerId: number;
  text: string;
}
//T
export type Store = ReturnType<typeof createStore>;
//T
/** `latencyMs` says how many ms each user's lookups take, by user id. */
export function createStore({ latencyMs = {} }: { latencyMs?: Record<number, number> } = {}) {
  const users: User[] = [
    { id: 1, name: 'Alice', token: 'alice-token' },
    { id: 2, name: 'Bob', token: 'bob-token' },
    { id: 3, name: 'Cara', token: 'cara-token' },
  ];
  const settings: Record<number, Settings> = {
    1: { theme: 'dark', newestFirst: false, maxNoteLength: 100 },
    2: { theme: 'light', newestFirst: true, maxNoteLength: 100 },
    3: { theme: 'solarized', newestFirst: false, maxNoteLength: 10 },
  };
  const notes: Note[] = [{ id: 1, ownerId: 2, text: 'Buy milk' }];
  const lastSeen = new Map<number, number>();
  let nextNoteId = 2;

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const waitFor = (userId: number) => wait(latencyMs[userId] ?? 1);

  return {
    async findUserByToken(token: string) {
      await wait(1);
      return users.find((u) => u.token === token) ?? null;
    },
    async recordVisit(userId: number) {
      await waitFor(userId);
      lastSeen.set(userId, Date.now());
    },
    async loadSettings(userId: number) {
      await waitFor(userId);
      return settings[userId];
    },
    async notesOf(userId: number) {
      await waitFor(userId);
      return notes.filter((n) => n.ownerId === userId);
    },
    async addNote(userId: number, text: string) {
      await waitFor(userId);
      const note = { id: nextNoteId++, ownerId: userId, text };
      notes.push(note);
      return note;
    },
  };
}
