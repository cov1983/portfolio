// The typed Content as build/content-plugin.ts emits it (plan §5). An ambient module declaration
// cannot live in a module file, so it sits here instead of types.ts; the type arrives through an
// import type expression because typescript-eslint's program (unlike tsc) resolves no import
// statement inside an ambient module block (found on #27 by the first consumer of this module).
declare module 'virtual:content' {
  export const content: import('./types.ts').Content
}
