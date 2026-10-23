const DEFAULTS = {
  theme: 'light',
  language: 'en',
  notifications: { email: true, sms: false, weeklyDigest: true },
};

// A new user's preferences: the defaults plus whatever they chose at sign-up.
export function createPreferences(choices = {}) {
  const prefs = { ...DEFAULTS, ...choices, notifications: DEFAULTS.notifications };
  if (choices.notifications) {
    Object.assign(prefs.notifications, choices.notifications);
  }
  return prefs;
}

// Turns one notification channel on or off, e.g. setNotification(prefs, 'email', false).
export function setNotification(prefs, channel, enabled) {
  if (!(channel in prefs.notifications)) {
    throw new Error(`Unknown notification channel: ${channel}`);
  }
  prefs.notifications[channel] = enabled;
  return prefs;
}

// What the settings page shows next to "Reset to defaults".
export function getDefaults() {
  return DEFAULTS;
}
