import { defineConfig } from 'vitest/config';

// Tests for the app itself. Challenge tests under challenges/ are run
// separately by the validation script and the server, never by this config.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'node',
          include: ['packages/server/src/**/*.test.ts', 'scripts/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'web',
          include: ['packages/web/src/**/*.test.{ts,tsx}'],
          environment: 'happy-dom',
        },
      },
    ],
  },
});
