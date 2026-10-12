import type { Content } from '../content/types.ts'

// The Fallback Page (spec: Fallback Page; ADR 0004): pre-rendered at build into
// dist/exhibits/index.html, no script. T4 Task 3 completes it.
type Props = { content: Content }

export function FallbackPage({ content }: Props) {
  return (
    <>
      <header>
        <h1>{content.owner.name}</h1>
      </header>
      <main>
        <nav aria-label="Site">
          <a href="/">Back to the Title Screen</a>
        </nav>
      </main>
    </>
  )
}
