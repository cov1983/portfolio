import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'

const root = document.getElementById('root')
if (root === null) {
  throw new Error('index.html has no #root element')
}

const reactRoot = createRoot(root)

function render(node: ReactNode): void {
  reactRoot.render(<StrictMode>{node}</StrictMode>)
}

// The `?world` guard (plan §9 risk 10): `?world` mounts the World at once, regardless of the
// preload policy; it never replaces the Title Screen. Before T4 there is no Title Screen, so the
// root shows a placeholder and `/?world` shows the World alone. T5b removes the guard. The World
// arrives by dynamic import, so the entry chunk never imports the `world` chunk (ADR 0010).
if (new URLSearchParams(window.location.search).has('world')) {
  import('./world/World')
    .then(({ World }) => {
      render(<World />)
    })
    .catch((error: unknown) => {
      // Structured, no personal data; T8b replaces it with the readable message (AC-22.2).
      console.error('World chunk failed', error)
    })
} else {
  render(
    <main>
      <h1>Portfolio</h1>
    </main>,
  )
}
