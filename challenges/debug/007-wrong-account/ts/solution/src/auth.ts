import type { NextFunction, Request, Response } from 'express';
import type { Store } from './store';

/**
 * Signs in the person whose token is in the Authorization header. The user is kept on
 * res.locals because it belongs to this request; a server handles many at once.
 */
export function authenticate(store: Store) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = (req.get('authorization') ?? '').replace('Bearer ', '');
    const user = await store.findUserByToken(token);
    if (!user) return res.status(401).json({ error: 'Not signed in' });
    res.locals.user = user;
    next();
  };
}
