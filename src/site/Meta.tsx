import type { Content } from '../content/types.ts'

// The head of a pre-rendered document (AC-3.1): rendered to a string by src/entry-prerender.tsx
// and placed at index.html's <!--app-head--> by build/build.ts. T4 Task 2 adds the description,
// the Open Graph and the Twitter tags.
export type Page = 'title-screen' | 'fallback-page'

type Props = { content: Content; page: Page }

function pageTitle(content: Content, page: Page): string {
  return page === 'title-screen'
    ? `${content.owner.name} — portfolio`
    : `Exhibits — ${content.owner.name}`
}

export function Meta({ content, page }: Props) {
  return <title>{pageTitle(content, page)}</title>
}
