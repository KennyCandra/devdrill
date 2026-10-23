# Settings leak between users

Support tickets keep coming in: "I never turned off email notifications, but they're off!"

It turns out that when one user turns a notification channel off, **new users who sign up afterwards** get it off too. Sometimes existing users are affected as well.

## Your task

Find out how one user's settings reach other users and fix it. Make sure the defaults stay safe too: code that reads them (like `getDefaults()`, which the settings page uses for "Reset to defaults") must not be able to change them. All tests must pass.

## What it should return

```js
const ana = createPreferences({ theme: 'dark' });
const ben = createPreferences();

setNotification(ana, 'email', false);

ana;               // { theme: 'dark', language: 'en', notifications: { email: false, sms: false, weeklyDigest: true } }
ben.notifications; // { email: true, sms: false, weeklyDigest: true }: unchanged
createPreferences().notifications; // { email: true, sms: false, weeklyDigest: true }: unchanged
getDefaults().notifications;       // { email: true, sms: false, weeklyDigest: true }: unchanged
```

- Choices made at sign-up only affect that user, and keep the other defaults (`createPreferences({ notifications: { sms: true } })` still has `email: true`).
- `setNotification` throws for a channel that doesn't exist.

## Files

- `src/preferences.js`: default preferences and changing them
- `tests/preferences.test.js`: the existing tests
