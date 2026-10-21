import { defineConfig, globalIgnores } from 'eslint/config'
import prettier from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default defineConfig([
  globalIgnores([
    'dist/',
    'coverage/',
    'node_modules/',
    '.pnpm-store/',
    '.agents/',
    '.claude/',
    'mockups/',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      tseslint.configs.strictTypeChecked,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json', './tsconfig.node.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // A contract's callbacks are function-typed properties, never method signatures: a method
      // signature is bivariant and `unbound-method` fires on its destructured use (T1 #24, T5a #28;
      // ADR 0015).
      '@typescript-eslint/method-signature-style': ['error', 'property'],
    },
  },
  prettier,
])
