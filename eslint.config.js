// ESLint for every workspace. Type-aware rules run on source files; tests use the
// plain recommended set, since they deliberately poke at untyped HTTP bodies.
import js from '@eslint/js';
import jsxA11y from 'eslint-plugin-jsx-a11y-x';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/generated/**', '**/.test/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,js,mjs}'],
    languageOptions: { globals: globals.node },
    rules: {
      // `_name` marks a parameter that is intentionally unused (Express signatures).
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['backend/src/**/*.ts', 'shared/src/**/*.ts', 'frontend/src/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}'],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: {
      // A forgotten await in the ticker, runner, shutdown or a click handler would silently drop errors.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
    },
  },
  // Frontend: browser globals, hooks rules, fast refresh and strict accessibility checks.
  {
    files: ['frontend/src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    ...reactHooks.configs.flat['recommended-latest'],
  },
  { files: ['frontend/src/**/*.tsx'], ...reactRefresh.configs.vite },
  { files: ['frontend/src/**/*.tsx'], ...jsxA11y.configs.strict },
  {
    // shadcn components export their cva variants next to the component (e.g. buttonVariants).
    files: ['frontend/src/core/components/ui/**/*.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
);
