import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// The client entry. `#root` holds the pre-rendered Title Screen (ADR 0010) and is left as it is:
// T5a hydrates it with hydrateRoot and records the title-screen-interactive mark.
//
// The `?world` guard (plan §9 risk 10): `?world` mounts the World at once, regardless of the
// preload policy, in a container of its own appended to the body; the World's element covers the
// viewport, so the Title Screen stays underneath, untouched. T5b removes the guard and mounts the
// World paused behind the Title Screen through the store. The World arrives by dynamic import, so
// the entry chunk never imports the `world` chunk (ADR 0010).
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
