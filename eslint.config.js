// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const nshapesPerfPlugin = require('./scripts/eslint-plugin-nshapes-perf');

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
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      'nshapes-perf': nshapesPerfPlugin,
    },
    rules: {
      'nshapes-perf/require-guarded-frame-callback': 'error',
      'nshapes-perf/no-frame-loop-allocations': 'error',
      'nshapes-perf/require-safe-infinite-animation': 'error',
      'nshapes-perf/single-lifecycle-and-audio-gateway': 'error',
      'nshapes-perf/no-row-text-overflow': 'error',
    },
  },
  {
    // Node CLI / hook scripts under scripts/
    files: ['scripts/**/*.js'],
    languageOptions: {
      globals: {
        __dirname: 'readonly',
        __filename: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        console: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        fetch: 'readonly',
        AbortSignal: 'readonly',
        URL: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
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
