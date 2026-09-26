// ESLint for backend/ and shared/ (the frontend gets its own React rules in F1).
// Type-aware rules run on source files; tests use the plain recommended set, since
// they deliberately poke at untyped HTTP bodies.
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/generated/**', 'frontend/**', '**/.test/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,js,mjs}'],
    languageOptions: { globals: globals.node },
    rules: {
      // `_name` marks a parameter that is intentionally unused (Express signatures).
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['backend/src/**/*.ts', 'shared/src/**/*.ts'],
    ignores: ['**/*.test.ts'],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: {
      // A forgotten await in the ticker, runner or shutdown would silently drop errors.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
    },
  },
);
