/* eslint-env node */
module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  plugins: ['react-refresh'],
  ignorePatterns: ['dist', 'coverage', 'node_modules', '.eslintrc.cjs'],
  rules: {
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
  overrides: [
    {
      files: ['**/__tests__/**/*.{ts,tsx}', 'src/tests/**/*.ts'],
      env: { node: true },
      rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
    },
    {
      files: ['vite.config.ts'],
      env: { node: true },
    },
    {
      // A Context module exporting both its provider and its hook is the intended
      // shape here; splitting them just to satisfy fast refresh is not worth it.
      files: ['src/store/*.tsx'],
      rules: { 'react-refresh/only-export-components': 'off' },
    },
  ],
}
