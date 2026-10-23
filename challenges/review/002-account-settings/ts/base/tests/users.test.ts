import { getProfile } from '../src/users';

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
