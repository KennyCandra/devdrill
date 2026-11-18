// The only Vitest config used for challenge runs. It is passed with --config, so a
// vitest.config.js the user creates in their workspace can't change which tests run.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export default {
  resolve: {
    // Workspaces have no node_modules: Express challenges use the app's own copy.
    alias: [{ find: /^express$/, replacement: require.resolve('express') }],
  },
};
