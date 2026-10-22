import { createPreferences, getDefaults, setNotification } from '../src/preferences.js';

describe('createPreferences', () => {
  it('starts from the defaults', () => {
    expect(createPreferences()).toEqual(getDefaults());
  });

  it('applies choices made at sign-up', () => {
    expect(createPreferences({ theme: 'dark' }).theme).toBe('dark');
  });
});

describe('setNotification', () => {
  it('turns a channel off', () => {
    const prefs = setNotification(createPreferences(), 'email', false);
    expect(prefs.notifications.email).toBe(false);
  });

  it("doesn't change what the next new user gets", () => {
    setNotification(createPreferences(), 'email', false);
    const newUser = createPreferences();
    expect(newUser.notifications.email).toBe(true);
  });
});
