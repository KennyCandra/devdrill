import type { NextFunction, Request, Response } from 'express';
import type { Store, User } from './store';

let signedIn: User | null = null;

/** The person making this request. */
export function currentUser(): User {
  if (!signedIn) throw new Error('Nobody is signed in');
  return signedIn;
}

/** Signs in the person whose token is in the Authorization header. */
export function authenticate(store: Store) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = (req.get('authorization') ?? '').replace('Bearer ', '');
    const user = await store.findUserByToken(token);
    if (!user) return res.status(401).json({ error: 'Not signed in' });
    signedIn = user;
    next();
  };
}
