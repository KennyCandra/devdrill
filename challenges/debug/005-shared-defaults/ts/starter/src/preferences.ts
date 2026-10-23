export interface Notifications {
  email: boolean;
  sms: boolean;
  weeklyDigest: boolean;
}

export interface Preferences {
  theme: string;
  language: string;
  notifications: Notifications;
}

/** What a user picks at sign-up: any fields, and only some notification channels. */
export type Choices = Partial<Omit<Preferences, 'notifications'>> & {
  notifications?: Partial<Notifications>;
};

const DEFAULTS: Preferences = {
  theme: 'light',
  language: 'en',
  notifications: { email: true, sms: false, weeklyDigest: true },
};

// A new user's preferences: the defaults plus whatever they chose at sign-up.
export function createPreferences(choices: Choices = {}): Preferences {
  const prefs = { ...DEFAULTS, ...choices, notifications: DEFAULTS.notifications };
  if (choices.notifications) {
    Object.assign(prefs.notifications, choices.notifications);
  }
  return prefs;
}

// Turns one notification channel on or off, e.g. setNotification(prefs, 'email', false).
// `channel` comes straight from the settings form, so it's checked here.
export function setNotification(prefs: Preferences, channel: string, enabled: boolean): Preferences {
  if (!Object.hasOwn(prefs.notifications, channel)) {
    throw new Error(`Unknown notification channel: ${channel}`);
  }
  prefs.notifications[channel as keyof Notifications] = enabled;
  return prefs;
}

// What the settings page shows next to "Reset to defaults".
export function getDefaults(): Preferences {
  return DEFAULTS;
}
