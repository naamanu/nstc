import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist/'] },
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Honor the `_unused` convention for intentionally-unused params/vars.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // node:test's test()/describe()/it() return promises the runner awaits;
      // calling them without `await` is the intended usage, not a floating promise.
      '@typescript-eslint/no-floating-promises': [
        'error',
        {
          allowForKnownSafeCalls: [
            {
              from: 'package',
              package: 'node:test',
              name: ['test', 'describe', 'it', 'before', 'after', 'beforeEach', 'afterEach'],
            },
          ],
        },
      ],
    },
  },
  // Keep eslint-config-prettier last so it can turn off any stylistic rules
  // that would otherwise conflict with Prettier formatting.
  prettier,
);
