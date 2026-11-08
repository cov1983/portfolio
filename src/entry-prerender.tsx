import { renderToStaticMarkup, renderToString } from 'react-dom/server'
import { content } from 'virtual:content'

import { App } from './app/App'
import { createStore } from './app/store'
import { FallbackPage } from './site/FallbackPage'
import { Meta } from './site/Meta'
import { StartPage } from './site/StartPage'

// The pre-rendering entry (ADR 0010): built by Vite as an SSR bundle and imported by
// build/build.ts, which places `head` and `body` into the client build's index.html for each
// route of build/prerender.ts (ADR 0010, 0018). The Title Screen is rendered with renderToString
// from the same App tree and initial store that src/main.tsx hydrates (T5a); the Fallback Page and
// /start ship no script, so static markup is enough. `origin` is the site's origin when the build knows it, else ''
// (build/prerender.ts siteOrigin). Titles: Owner on #27 Q8.
export type Prerendered = { head: string; body: string }

export function prerender(route: string, origin: string): Prerendered {
  // Each document names its title and description where it is rendered; previewTitle only where a
  // document's link previews show its own title rather than the Owner's name (/start).
  const meta = (title: string, description: string, previewTitle?: string) => (
    <Meta
      content={content}
      title={title}
      description={description}
      previewTitle={previewTitle}
      path={route}
      origin={origin}
    />
  )
  switch (route) {
    case '/':
      return {
        head: renderToStaticMarkup(meta(`${content.owner.name} — portfolio`, content.oneLine)),
        body: renderToString(<App content={content} store={createStore()} />),
      }
    case '/exhibits':
      return {
        head: renderToStaticMarkup(meta(`Exhibits — ${content.owner.name}`, content.oneLine)),
        body: renderToStaticMarkup(<FallbackPage content={content} />),
      }
    case '/start': {
      const title = `Start a project — ${content.owner.name}`
      return {
        head: renderToStaticMarkup(meta(title, content.start.sentence, title)),
        body: renderToStaticMarkup(<StartPage content={content} />),
      }
    }
    default:
      throw new Error(`no pre-rendered route ${route}`)
  }
}
