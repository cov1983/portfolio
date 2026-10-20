import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { content } from 'virtual:content'

import { App } from './app/App'
import { createStore } from './app/store'

// The client entry. `#root` holds the pre-rendered Title Screen (ADR 0010): hydrateRoot adopts it
// with the same App tree and initial store the build rendered, and App records the
// title-screen-interactive mark once the hydrated tree is interactive (T5a), then preloads the
// World and mounts it paused behind the Title Screen through the store (T5b, plan §2). The content
// travels in this chunk, so hydration needs no further request; the World arrives by dynamic
// import, so this chunk never imports the `world` chunk (ADR 0010). React's default
// onRecoverableError stays: a hydration mismatch reaches the page as an uncaught error, which the
// e2e fixture fails on. onCaughtError is overridden (Owner, #33 Q3): React's default would log an
// error the failure boundary caught a second time, raw; the boundary reports it to App, whose
// `World failed` line is the one structured line per failure (plan §7). Nothing is swallowed:
// the kind and the message are in that line, and the e2e tests consume exactly one.
const root = document.getElementById('root')
if (root !== null) {
  const app = (
    <StrictMode>
      <App content={content} store={createStore()} />
    </StrictMode>
  )
  // Dev server only: it serves the raw index.html with an empty root, nothing is pre-rendered, so
  // the Title Screen is rendered on the client; the production build drops this branch.
  if (import.meta.env.DEV && root.childElementCount === 0) {
    createRoot(root).render(app)
  } else {
    hydrateRoot(root, app, { onCaughtError: () => undefined })
  }
}
