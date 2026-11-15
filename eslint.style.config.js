import simpleImportSort from 'eslint-plugin-simple-import-sort';
import ts from 'typescript-eslint';

// Initialisation and CSS imports keep their exact evaluation order.
const importSort = {
  rules: {
    imports: {
      ...simpleImportSort.rules.imports,
      create(context) {
        const hasSideEffectImports = context.sourceCode.ast.body.some(
          (node) => node.type === 'ImportDeclaration' && node.specifiers.length === 0,
        );

        return hasSideEffectImports ? {} : simpleImportSort.rules.imports.create(context);
      },
    },
  },
};

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.cache/**',
      '**/*.min.js',
      '.git/**',
      '.agents/**',
      '.codex/**',
      '.aws/**',
      '.husky/_/**',
      '.pipeline-artifacts/**',
      'backups/**',
      'investigation/**',
      'data/**',
      'infra/supabase/**',
      'infra/models/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  {
    files: ['**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}'],
    languageOptions: {
      parser: ts.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'simple-import-sort': importSort, '@typescript-eslint': ts.plugin },
    linterOptions: { reportUnusedDisableDirectives: false },
    rules: {
      'simple-import-sort/imports': [
        'error',
        {
          groups: [
            ['^react$', '^react-dom(?:/.*)?$', '^(?!@wardrobe/)(?:node:|@?\\w)'],
            ['^@wardrobe/'],
            ['^(?:\\.\\./){2,}(?:app|components|lib|styles|integrations|pipelines)(?:/|$)'],
            ['^(?:\\.\\./){2,}'],
            ['^\\.'],
          ],
        },
      ],
      'padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: 'import', next: '*' },
        { blankLine: 'any', prev: 'import', next: 'import' },
        { blankLine: 'always', prev: '*', next: 'block-like' },
        { blankLine: 'always', prev: '*', next: ['const', 'let', 'var'] },
        { blankLine: 'always', prev: ['const', 'let', 'var'], next: '*' },
        { blankLine: 'any', prev: ['const', 'let', 'var'], next: ['const', 'let', 'var'] },
        { blankLine: 'always', prev: '*', next: 'function' },
        { blankLine: 'always', prev: 'function', next: '*' },
        { blankLine: 'always', prev: 'block-like', next: '*' },
        { blankLine: 'always', prev: '*', next: 'return' },
      ],
    },
  },
];
