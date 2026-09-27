// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      'dist/*',
      // Dynamic command shims vendored by the project template: they are not
      // application code and are generated elsewhere.
      'scripts/cmd-guard/**',
    ],
  },
  {
    // Build and guard scripts run in Node, not in the React Native runtime.
    files: ['scripts/**/*.{js,mjs}'],
    languageOptions: {
      globals: {
        require: 'readonly',
        module: 'readonly',
        process: 'readonly',
        console: 'readonly',
        __dirname: 'readonly',
        Buffer: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
]);
