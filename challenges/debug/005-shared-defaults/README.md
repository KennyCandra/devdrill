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

- Changing one user's preferences never changes another user's.
- Choices made at sign-up only affect that user, and keep the other defaults (`createPreferences({ notifications: { sms: true } })` still has `email: true`).
- `setNotification` throws for a channel that doesn't exist.

## Data

**Preferences**

| Field           | Type                 | Meaning                       |
| --------------- | -------------------- | ----------------------------- |
| `theme`         | text, e.g. `"light"` or `"dark"` | Color theme       |
| `language`      | text, e.g. `"en"`    | Interface language            |
| `notifications` | **Notifications**    | Which channels are on         |

**Notifications**

| Field          | Type       | Meaning                    |
| -------------- | ---------- | -------------------------- |
| `email`        | true/false | Email notifications on?    |
| `sms`          | true/false | Text messages on?          |
| `weeklyDigest` | true/false | Weekly summary email on?   |

**Functions**

| Function                                   | Returns                                              |
| ------------------------------------------ | ---------------------------------------------------- |
| `createPreferences(choices)`               | new **Preferences**: the defaults plus `choices` (any of the fields above; `notifications` may list only some channels) |
| `setNotification(prefs, channel, enabled)` | the same **Preferences**, changed. `channel` is `"email"`, `"sms"` or `"weeklyDigest"`; throws for anything else |
| `getDefaults()`                            | the default **Preferences**                          |

## Files

- `src/preferences`: default preferences and changing them
- `tests/preferences.test`: the existing tests
