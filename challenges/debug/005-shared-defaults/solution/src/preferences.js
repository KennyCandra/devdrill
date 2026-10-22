const DEFAULTS = {
  theme: 'light',
  language: 'en',
  notifications: { email: true, sms: false, weeklyDigest: true },
};

// A new user's preferences: the defaults plus whatever they chose at sign-up.
// structuredClone gives every user their own copy, nested objects included.
export function createPreferences(choices = {}) {
  const defaults = structuredClone(DEFAULTS);
  return {
    ...defaults,
    ...choices,
    notifications: { ...defaults.notifications, ...choices.notifications },
  };
}

// Turns one notification channel on or off, e.g. setNotification(prefs, 'email', false).
export function setNotification(prefs, channel, enabled) {
  if (!(channel in prefs.notifications)) {
    throw new Error(`Unknown notification channel: ${channel}`);
  }
  prefs.notifications[channel] = enabled;
  return prefs;
}

// What the settings page shows next to "Reset to defaults". A copy, so callers can't change it.
export function getDefaults() {
  return structuredClone(DEFAULTS);
}
