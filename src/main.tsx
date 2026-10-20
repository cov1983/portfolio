import { StrictMode } from 'react'
import { createRoot, hydrateRoot, type RootOptions } from 'react-dom/client'
import { content } from 'virtual:content'

import { App } from './app/App'
import { FailureBoundary } from './app/FailureBoundary'
import { createStore } from './app/store'

// The client entry. `#root` holds the pre-rendered Title Screen (ADR 0010): hydrateRoot adopts it
// with the same App tree and initial store the build rendered, and App records the
// title-screen-interactive mark once the hydrated tree is interactive (T5a), then preloads the
// World and mounts it paused behind the Title Screen through the store (T5b, plan §2). The content
// travels in this chunk, so hydration needs no further request; the World arrives by dynamic
// import, so this chunk never imports the `world` chunk (ADR 0010). React's default
// onRecoverableError stays: a hydration mismatch reaches the page as an uncaught error, which the
// e2e fixture fails on. onCaughtError is overridden for the failure boundary alone (Owner, #33
// Q3; narrowed after ai-review on #64): React's default would log an error that boundary caught a
// second time, raw; the boundary reports it to App, whose `World failed` line is the one
// structured line per failure (plan §7). Nothing is swallowed: the kind and the message are in
// that line, and the e2e tests consume exactly one. An error any other boundary catches is
// logged as React would, the component stack beside it, so a later boundary that does not report
// cannot go silent and stays as debuggable as React's default makes it.
const rootOptions: RootOptions = {
  onCaughtError: (error, info) => {
    if (!(info.errorBoundary instanceof FailureBoundary)) console.error(error, info.componentStack)
  },
}
const root = document.getElementById('root')
if (root !== null) {
  const app = (
    <StrictMode>
      <App content={content} store={createStore()} />
    </StrictMode>
  )
  // Dev server only: it serves the raw index.html with an empty root, nothing is pre-rendered, so
  // the Title Screen is rendered on the client; the production build drops this branch. The same
  // options, so a caught error is handled alike under `make dev` and in the build.
  if (import.meta.env.DEV && root.childElementCount === 0) {
    createRoot(root, rootOptions).render(app)
  } else {
    hydrateRoot(root, app, rootOptions)
  }
}
