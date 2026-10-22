# Settings leak between users

Support tickets keep coming in: "I never turned off email notifications, but they're off!"

It turns out that when one user turns a notification channel off, **new users who sign up afterwards** get it off too. Sometimes existing users are affected as well.

## Your task

Find out how one user's settings reach other users and fix it. All tests must pass.

## Files

- `src/preferences.js`: default preferences and changing them
- `tests/preferences.test.js`: the existing tests
