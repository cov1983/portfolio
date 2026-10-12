import { renderToStaticMarkup, renderToString } from 'react-dom/server'
import { content } from 'virtual:content'

import { FallbackPage } from './site/FallbackPage'
import { Meta } from './site/Meta'
import { TitleScreen } from './site/TitleScreen'

// The pre-rendering entry (ADR 0010): built by Vite as an SSR bundle and imported by
// build/build.ts, which places `head` and `body` into the client build's index.html for each
// route of build/prerender.ts. The Title Screen is rendered with renderToString, the markup
// hydrateRoot adopts (T5a); the Fallback Page ships no script, so static markup is enough.
// `origin` is the site's origin when the build knows it, else '' (build/prerender.ts siteOrigin).
// Titles: Owner on #27 Q8.
export type Prerendered = { head: string; body: string }

export function prerender(route: string, origin: string): Prerendered {
  const meta = (title: string) => (
    <Meta content={content} title={title} path={route} origin={origin} />
  )
  switch (route) {
    case '/':
      return {
        head: renderToStaticMarkup(meta(`${content.owner.name} — portfolio`)),
        body: renderToString(<TitleScreen content={content} />),
      }
    case '/exhibits':
      return {
        head: renderToStaticMarkup(meta(`Exhibits — ${content.owner.name}`)),
        body: renderToStaticMarkup(<FallbackPage content={content} />),
      }
    default:
      throw new Error(`no pre-rendered route ${route}`)
  }
}
