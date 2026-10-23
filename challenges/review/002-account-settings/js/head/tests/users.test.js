import { getAccount, getProfile, updateEmail } from '../src/users.js';

const ada = { id: 1, name: 'Ada' };
const linus = { id: 2, name: 'Linus' };

describe('profiles', () => {
  it('shows a public profile', () => {
    expect(getProfile({ user: null, params: { id: '1' } })).toEqual({
      status: 200,
      body: { id: 1, name: 'Ada', avatar: 'ada.png' },
    });
  });

  it('answers 404 for an unknown user', () => {
    expect(getProfile({ user: null, params: { id: '99' } }).status).toBe(404);
  });
});

describe('account settings', () => {
  it('shows your own account', () => {
    const response = getAccount({ user: ada, params: { id: '1' } });
    expect(response.status).toBe(200);
    expect(response.body.email).toBe('ada@example.com');
  });

  it('needs you to be signed in', () => {
    expect(getAccount({ user: null, params: { id: '1' } }).status).toBe(401);
  });

  it('changes your email', () => {
    const response = updateEmail({
      user: linus,
      params: { id: '2' },
      body: { email: 'linus@kernel.example' },
    });
    expect(response).toEqual({
      status: 200,
      body: { id: 2, name: 'Linus', avatar: 'linus.png', email: 'linus@kernel.example' },
    });
  });

  it("can't change someone else's email", () => {
    const response = updateEmail({ user: ada, params: { id: '2' }, body: { email: 'x@y.z' } });
    expect(response.status).toBe(403);
  });
});
