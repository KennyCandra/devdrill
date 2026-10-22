import { createPreferences, getDefaults, setNotification } from '../src/preferences.js';

describe('preferences', () => {
  it('keeps two existing users independent', () => {
    const ana = createPreferences();
    const ben = createPreferences();
    setNotification(ana, 'sms', true);
    expect(ben.notifications.sms).toBe(false);
  });

  it("doesn't let sign-up choices change the defaults", () => {
    createPreferences({ notifications: { weeklyDigest: false } });
    expect(getDefaults().notifications.weeklyDigest).toBe(true);
    expect(createPreferences().notifications.weeklyDigest).toBe(true);
  });

  it('keeps the other channels when a user picks one at sign-up', () => {
    const prefs = createPreferences({ notifications: { sms: true } });
    expect(prefs.notifications).toEqual({ email: true, sms: true, weeklyDigest: true });
  });

  it('protects the defaults from whoever reads them', () => {
    getDefaults().notifications.email = false;
    getDefaults().theme = 'pink';
    expect(createPreferences().notifications.email).toBe(true);
    expect(createPreferences().theme).toBe('light');
  });

  it('regression: rejects an unknown channel', () => {
    expect(() => setNotification(createPreferences(), 'fax', true)).toThrow('Unknown');
  });
});
