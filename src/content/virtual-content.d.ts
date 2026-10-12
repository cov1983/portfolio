// The typed Content as build/content-plugin.ts emits it (plan §5). An ambient module declaration
// cannot live in a module file, so it sits here instead of types.ts.
declare module 'virtual:content' {
  import type { Content } from './types'

  export const content: Content
}
