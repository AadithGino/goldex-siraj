import js from '@eslint/js'
import globals from 'globals'

export default [
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2024,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      // Keep lint non-invasive: do not force a formatting rewrite.
      // PascalCase args (e.g. icon: Icon) are ignored because JSX usage
      // of renamed destructured components is not always counted without react plugin.
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_|^[A-Z]',
        varsIgnorePattern: '^[A-Z_]',
        caughtErrorsIgnorePattern: '^_',
      }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    files: ['**/*.{test,spec}.{js,jsx}', 'vitest.config.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2024,
      },
    },
  },
]
