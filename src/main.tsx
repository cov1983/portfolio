// PROTOTYPE (chore/prototype-q1-q4, throwaway): the `site` chunk. Hydrates the pre-rendered stub
// Title Screen in index.html, records `title-screen-interactive` after hydrateRoot has committed,
// then imports the `world` chunk in an idle callback and mounts it behind the Title Screen.
import { StrictMode, useEffect, useState, type ComponentType } from 'react'
import { hydrateRoot } from 'react-dom/client'

export const TITLE_SCREEN_INTERACTIVE_MARK = 'title-screen-interactive'

function App() {
  const [World, setWorld] = useState<ComponentType | null>(null)
  const [entered, setEntered] = useState(false)
  useEffect(() => {
    if (performance.getEntriesByName(TITLE_SCREEN_INTERACTIVE_MARK, 'mark').length === 0) {
      performance.mark(TITLE_SCREEN_INTERACTIVE_MARK)
    }
    const id = requestIdleCallback(() => {
      void import('#world').then((m) => {
        setWorld(() => m.World)
      })
    })
    return () => {
      cancelIdleCallback(id)
    }
  }, [])
  return (
    <>
      <main
        style={entered ? { display: 'none' } : { position: 'relative', zIndex: 1, background: '#fff' }}
      >
        <h1>Thomas Cova</h1>
        <button
          type="button"
          onClick={() => {
            setEntered(true)
          }}
        >
          Enter the World
        </button>
      </main>
      {World === null ? null : <World />}
    </>
  )
}

const root = document.getElementById('root')
if (root === null) throw new Error('index.html has no #root element')

hydrateRoot(
  root,
  <StrictMode>
    <App />
  </StrictMode>,
)
