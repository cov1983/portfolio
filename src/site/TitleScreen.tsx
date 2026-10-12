import type { Content } from '../content/types.ts'

// The static Title Screen (spec: Title Screen; ADR 0004, ADR 0010): pre-rendered at build into
// dist/index.html. T4 Task 2 completes it; T5a hydrates this exact markup.
type Props = { content: Content }

export function TitleScreen({ content }: Props) {
  return (
    <main className="title-screen">
      <h1>{content.owner.name}</h1>
      <p className="one-line">{content.oneLine}</p>
    </main>
  )
}
