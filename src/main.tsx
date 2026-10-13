import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { content } from 'virtual:content'

import { App } from './app/App'
import { createStore } from './app/store'

// The client entry. `#root` holds the pre-rendered Title Screen (ADR 0010): hydrateRoot adopts it
// with the same App tree and initial store the build rendered, and App records the
// title-screen-interactive mark once the hydrated tree is interactive (T5a). The content travels
// in this chunk, so hydration needs no further request. React's default onRecoverableError stays:
// a hydration mismatch reaches the page as an uncaught error, which the e2e fixture fails on.
//
// The `?world` guard (plan §9 risk 10): `?world` mounts the World at once, regardless of the
// preload policy, in a container of its own appended to the body; the World's element covers the
// viewport, so the Title Screen hydrates underneath, untouched, and both marks fire there (the
// perf run's URL until T5b). T5b removes the guard and mounts the World paused behind the Title
// Screen through the store. The World arrives by dynamic import, so the entry chunk never imports
// the `world` chunk (ADR 0010).
if (new URLSearchParams(window.location.search).has('world')) {
  const container = document.createElement('div')
  document.body.append(container)
  import('./world/World')
    .then(({ World }) => {
      createRoot(container).render(
        <StrictMode>
          <World />
        </StrictMode>,
      )
    })
    .catch((error: unknown) => {
      // Structured, no personal data; T8b replaces it with the readable message (AC-22.2).
      console.error('World chunk failed', error)
    })
}

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
    hydrateRoot(root, app)
  }
}
