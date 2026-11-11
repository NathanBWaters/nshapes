// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      'dist/*',
      'web-build/*',
      '.expo/*',
      'playwright-report/*',
      'test-results/*',
      'public/*',
      'specs/*',
      'nshapes_audio/*',
    ],
  },
  {
    rules: {
      // React Native <Text> renders quotes and apostrophes literally; escaping is web-only advice.
      'react/no-unescaped-entities': 'off',
      // require() is how React Native loads assets, guards optional native modules,
      // and builds jest.mock() factories.
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    // Jest globals for tests and the Jest setup file
    files: ['__tests__/**/*.{ts,tsx,js}', 'jest.setup.js'],
    languageOptions: {
      globals: {
        jest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        beforeEach: 'readonly',
        afterAll: 'readonly',
        afterEach: 'readonly',
      },
    },
  },
]);
