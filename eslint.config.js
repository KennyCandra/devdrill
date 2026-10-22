import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    // challenges/ contains intentionally buggy code; it is checked by the
    // validation script instead of the linter.
    ignores: ['**/node_modules/**', '**/dist/**', 'challenges/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      // @bughunt/shared is types-only and is never built or published,
      // so a runtime import of it would crash the published server.
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@bughunt/shared',
              message: '@bughunt/shared is types-only. Use `import type`.',
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },
  {
    // Vitest's asymmetric matchers (expect.any, expect.stringContaining) are typed as any.
    files: ['**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
    },
  },
  {
    files: ['packages/server/**', 'scripts/**', '*.config.{js,ts}'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    files: ['packages/web/**'],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
);
