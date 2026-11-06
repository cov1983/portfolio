import { defineConfig, globalIgnores } from 'eslint/config'
import prettier from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

// The invite CLI's import closure (ADR 0019; plan increment-2 §6; #101): `make invite` runs
// scripts/invite.ts under plain Node with no node_modules, so the closure is exactly these four
// files plus node:*, each file allowed only the imports it is listed with. Type-only imports are
// erased and allowed. Probed in #101's plan:
// - `group` is gitignore syntax: '*' also excludes the `..` directories of a relative path, and a
//   file under an excluded directory cannot be re-included, so '!*/' re-includes directories first.
//   A specifier ending in '/' therefore passes, but Node's ESM loader cannot load one.
// - `allowTypeImports` also passes `import { type X } from 'm'`, which Node's type stripping keeps
//   as a runtime import: no-import-type-side-effects requires `import type` there instead.
// - no-restricted-imports never sees `import()`: ImportExpression is banned outright.
// A createRequire from node:module would get past it; the gate catches mistakes, not intent.
const CLOSURE_MESSAGE =
  'The invite CLI runs under plain Node with no node_modules: its closure is node:*, scripts/invite.ts, scripts/invite/run.ts, src/intake/invite.ts and src/intake/server/sign.ts (ADR 0019).'

function importClosure(file, allowed, message = CLOSURE_MESSAGE) {
  return {
    files: [file],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['*', '!*/', ...allowed.map((specifier) => `!${specifier}`)],
              allowTypeImports: true,
              message,
            },
          ],
        },
      ],
      '@typescript-eslint/no-import-type-side-effects': 'error',
      'no-restricted-syntax': ['error', { selector: 'ImportExpression', message }],
    },
  }
}

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
        project: ['./tsconfig.json', './tsconfig.node.json', './tsconfig.server.json'],
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
  importClosure('scripts/invite.ts', ['node:*', './invite/run.ts']),
  importClosure('scripts/invite/run.ts', [
    'node:*',
    '../../src/intake/invite.ts',
    '../../src/intake/server/sign.ts',
  ]),
  importClosure('src/intake/server/sign.ts', ['node:*', '../invite.ts']),
  // Shared with the Discovery Form's page: no node:* (module boundary, plan §2), so nothing at all.
  importClosure(
    'src/intake/invite.ts',
    [],
    'src/intake/invite.ts is shared by the invite CLI, the page and the function: it imports nothing, not even node:* (ADR 0019).',
  ),
  prettier,
])
