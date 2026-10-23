# Show "last seen" as a relative time

## What this PR does

The friends list now shows when each friend was last online, as a relative time:

| Time since they were last seen | Shown as        |
| ------------------------------ | --------------- |
| under a minute                 | `just now`      |
| under an hour                  | `5 minutes ago` |
| under a day                    | `3 hours ago`   |
| under a week                   | `2 days ago`    |
| a week or more                 | `2026-03-14`    |

- Counts are whole units, rounded down: 90 minutes is `1 hour ago`.
- One unit is singular: `1 minute ago`, not `1 minutes ago`.
- A last-seen time slightly in the future (phones with a fast clock) counts as `just now`.
- Times are milliseconds since 1970 (`Date.now()`); dates are shown in UTC.

## How it was tested

- Tests for every row of the table, singular units, the one-week boundary and a future time.

## Your review

Review it like a teammate would. Comment on what must change before merging, and on anything worth improving. If the PR is good as it is, approve it.
