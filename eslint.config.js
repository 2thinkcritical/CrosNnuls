import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/', '.wrangler/', '.worker-build/', 'playwright-report/', 'test-results/'] },
  js.configs.recommended,
  {
    rules: {
      eqeqeq: ['error', 'always'],
      'no-implicit-coercion': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  { files: ['docs/**/*.js'], languageOptions: { globals: globals.browser } },
  { files: ['worker/**/*.js'], languageOptions: { globals: globals.serviceworker } },
  { files: ['tests/**', '*.config.js'], languageOptions: { globals: globals.node } },
  { files: ['tests/browser/**'], languageOptions: { globals: { ...globals.node, ...globals.browser } } },
];
