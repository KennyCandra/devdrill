// The user store. A user: { id, name, email, avatar, passwordHash }.

const users = new Map([
  [1, { id: 1, name: 'Ada', email: 'ada@example.com', avatar: 'ada.png', passwordHash: 'x9f…' }],
  [2, { id: 2, name: 'Linus', email: 'linus@example.com', avatar: 'linus.png', passwordHash: 'k2a…' }],
]);

export function findUser(id) {
  return users.get(Number(id)) ?? null;
}

/** What anyone may see about a user. */
export function publicProfile(user) {
  return { id: user.id, name: user.name, avatar: user.avatar };
}

// GET /users/:id: a public profile, for anyone.
export function getProfile(request) {
  const user = findUser(request.params.id);
  if (!user) return { status: 404 };
  return { status: 200, body: publicProfile(user) };
}
