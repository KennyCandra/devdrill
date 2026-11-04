import type { NextFunction, Request, Response } from 'express';
import type { Store } from './store';

export function requireUser(store: Store) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = (req.get('authorization') ?? '').replace('Bearer ', '');
    const user = await store.findUserByToken(token);
    if (!user) return res.status(401).json({ error: 'Not signed in' });
    res.locals.user = user;
    next();
  };
}
