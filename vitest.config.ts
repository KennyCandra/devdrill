import { defineConfig } from 'vitest/config';

// Tests for the app itself. Challenge tests under challenges/ are run
// separately by the validation script and the server, never by this config.
export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
});
