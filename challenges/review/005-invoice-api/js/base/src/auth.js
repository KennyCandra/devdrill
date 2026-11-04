
export function requireUser(store) {
  return async (req, res, next) => {
    const token = (req.get('authorization') ?? '').replace('Bearer ', '');
    const user = await store.findUserByToken(token);
    if (!user) return res.status(401).json({ error: 'Not signed in' });
    res.locals.user = user;
    next();
  };
}
