//T
//T
//T
//T
/** `latencyMs` says how many ms each user's lookups take, by user id. */
export function createStore({ latencyMs = {} } = {}) {
  const users = [
    { id: 1, name: 'Alice', token: 'alice-token' },
    { id: 2, name: 'Bob', token: 'bob-token' },
    { id: 3, name: 'Cara', token: 'cara-token' },
  ];
  const settings = {
    1: { theme: 'dark', newestFirst: false, maxNoteLength: 100 },
    2: { theme: 'light', newestFirst: true, maxNoteLength: 100 },
    3: { theme: 'solarized', newestFirst: false, maxNoteLength: 10 },
  };
  const notes = [{ id: 1, ownerId: 2, text: 'Buy milk' }];
  let nextNoteId = 2;

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const waitFor = (userId) => wait(latencyMs[userId] ?? 1);

  return {
    async findUserByToken(token) {
      await wait(1);
      return users.find((u) => u.token === token) ?? null;
    },
    async loadSettings(userId) {
      await waitFor(userId);
      return settings[userId];
    },
    async notesOf(userId) {
      await waitFor(userId);
      return notes.filter((n) => n.ownerId === userId);
    },
    async addNote(userId, text) {
      await waitFor(userId);
      const note = { id: nextNoteId++, ownerId: userId, text };
      notes.push(note);
      return note;
    },
  };
}
