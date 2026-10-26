# DevDrill in hosted mode, e.g. on Railway (see docs/HOSTING.md).
# Build: the web UI and the bundled server, the same package as `npm publish ./release`.
FROM node:22-slim AS build
WORKDIR /src
COPY . .
RUN npm ci --no-audit --no-fund && npm run build:release

# Run: only the release package and its runtime dependencies (express, open, vitest).
FROM node:22-slim
WORKDIR /app
COPY --from=build /src/release ./
RUN npm install --omit=dev --ignore-scripts --no-audit --no-fund
# Progress and workspaces: mount a volume here, or they're lost on every deploy.
ENV DEVDRILL_HOME=/data
# DEVDRILL_PUBLIC_URL and DEVDRILL_TOKEN come from the platform's variables.
CMD ["node", "dist/cli.js", "--no-open"]
