
let signedIn = null;

/** The person making this request. */
export function currentUser() {
  if (!signedIn) throw new Error('Nobody is signed in');
  return signedIn;
}

/** Signs in the person whose token is in the Authorization header. */
export function authenticate(store) {
  return async (req, res, next) => {
    const token = (req.get('authorization') ?? '').replace('Bearer ', '');
    const user = await store.findUserByToken(token);
    if (!user) return res.status(401).json({ error: 'Not signed in' });
    signedIn = user;
    next();
  };
}
