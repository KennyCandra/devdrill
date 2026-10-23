export interface User {
  id: number;
  name: string;
  email: string;
  avatar: string;
  passwordHash: string;
}

export interface Request {
  /** The signed-in user, or null. */
  user: Pick<User, 'id' | 'name'> | null;
  params: { id: string };
  body?: { email?: string };
}

export interface Response {
  status: number;
  body?: Record<string, unknown>;
}

const users = new Map<number, User>([
  [1, { id: 1, name: 'Ada', email: 'ada@example.com', avatar: 'ada.png', passwordHash: 'x9f…' }],
  [2, { id: 2, name: 'Linus', email: 'linus@example.com', avatar: 'linus.png', passwordHash: 'k2a…' }],
]);

export function findUser(id: string): User | null {
  return users.get(Number(id)) ?? null;
}

/** What anyone may see about a user. */
export function publicProfile(user: User): { id: number; name: string; avatar: string } {
  return { id: user.id, name: user.name, avatar: user.avatar };
}

// GET /users/:id: a public profile, for anyone.
export function getProfile(request: Request): Response {
  const user = findUser(request.params.id);
  if (!user) return { status: 404 };
  return { status: 200, body: publicProfile(user) };
}
