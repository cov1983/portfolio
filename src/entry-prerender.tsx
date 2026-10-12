import { renderToStaticMarkup, renderToString } from 'react-dom/server'
import { content } from 'virtual:content'

import { FallbackPage } from './site/FallbackPage'
import { Meta } from './site/Meta'
import { TitleScreen } from './site/TitleScreen'

// The pre-rendering entry (ADR 0010): built by Vite as an SSR bundle and imported by
// build/build.ts, which places `head` and `body` into the client build's index.html for each
// route of build/prerender.ts. The Title Screen is rendered with renderToString, the markup
// hydrateRoot adopts (T5a); the Fallback Page ships no script, so static markup is enough.
export type Prerendered = { head: string; body: string }

export function prerender(route: string): Prerendered {
  switch (route) {
    case '/':
      return {
        head: renderToStaticMarkup(<Meta content={content} page="title-screen" />),
        body: renderToString(<TitleScreen content={content} />),
      }
    case '/exhibits':
      return {
        head: renderToStaticMarkup(<Meta content={content} page="fallback-page" />),
        body: renderToStaticMarkup(<FallbackPage content={content} />),
      }
    default:
      throw new Error(`no pre-rendered route ${route}`)
  }
}
