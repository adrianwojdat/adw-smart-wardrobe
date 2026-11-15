import js from '@eslint/js';
import hooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import ts from 'typescript-eslint';

import styleConfig from './eslint.style.config.js';

export default ts.config(
  ...styleConfig,
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ['apps/**/*.{ts,tsx}', 'packages/**/*.{ts,tsx}', 'tests/**/*.ts'],
    languageOptions: { parserOptions: { projectService: true } },
    rules: {
      ...ts.configs.recommendedTypeChecked.at(-1).rules,
      '@typescript-eslint/no-unsafe-type-assertion': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
    },
  },
  {
    linterOptions: { reportUnusedDisableDirectives: 'warn' },
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': hooks },
    rules: { 'react-hooks/rules-of-hooks': 'error', 'react-hooks/exhaustive-deps': 'error' },
  },
);
