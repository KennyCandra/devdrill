# Hosting DevDrill for a few friends (Railway)

DevDrill is made to run on your own machine (`npx devdrill`). It can also run on a server in **hosted mode**, so a couple of trusted people can try it from a link.

Read this first:

- **Everyone with the link shares one progress** and one set of workspaces. Give **each person their own service** (their own link).
- **Running tests runs code on the server.** Anyone with the link can run any code there. Share links only with people you trust, never publicly.

## Hosted mode

Set these variables; without `DEVDRILL_PUBLIC_URL` the app runs normally (local).

| Variable              | Value                                                                      |
| --------------------- | -------------------------------------------------------------------------- |
| `DEVDRILL_PUBLIC_URL` | The URL people open, e.g. `https://devdrill-ada.up.railway.app`            |
| `DEVDRILL_TOKEN`      | A long random secret: `openssl rand -base64 32 \| tr "+/" "-_" \| tr -d =` |
| `PORT`                | Set by the platform                                                        |
| `DEVDRILL_HOME`       | `/data` (the Dockerfile sets it): mount a volume there                     |

The link to share is `DEVDRILL_PUBLIC_URL` + `/#token=` + `DEVDRILL_TOKEN`.

## Railway, step by step (per person)

1. In Railway: **New Project → Deploy from GitHub repo → `devdrill`**. It finds the `Dockerfile` and `railway.json`.
2. **Settings → Networking → Generate Domain.** Copy it (e.g. `devdrill-ada.up.railway.app`).
3. **Variables:** add `DEVDRILL_PUBLIC_URL` = `https://` + that domain, and `DEVDRILL_TOKEN` = a new secret (one per person).
4. **Add a volume** (right-click the service → Attach volume) with mount path `/data`. Without it, progress is lost on every deploy.
5. Deploy. The logs print `Open: https://…/#token=…`: that's the link to send.

For a second person, add another service from the same repo in the same project (steps 2–5), with its own domain, token and volume.
