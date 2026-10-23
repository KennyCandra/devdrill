# Account settings: view your account, change your email

## What this PR does

Adds two endpoints for the new account settings page:

- **`getAccount(request)`**: the signed-in user's own account page: name, email and avatar. **Only the signed-in user can see their own account**; anyone else gets 403, and nobody signed in gets 401.
- **`updateEmail(request)`**: changes the signed-in user's email. **The new email must look like `name@domain`**; anything else gets 400.

Rules every endpoint follows:

- **Never send `passwordHash` to the browser**, in any response.
- A request is `{ user, params, body }`: `user` is the signed-in user, or `null`.
- A response is `{ status, body }`.
- An unknown account id gets 404; ids aren't secret.

## How it was tested

- Added tests for both endpoints.

## Your review

Review it like a teammate would. Comment on what must change before merging, and on anything worth improving. If the PR is good as it is, approve it.
