import type { Content } from '../content/types.ts'

// The head of a pre-rendered document (AC-3.1): rendered to a string by src/entry-prerender.tsx
// and placed at index.html's <!--app-head--> by build/build.ts. The icon is /favicon.svg, which
// the build derives from the mark's one drawing, src/site/mark.svg (#75, AC-1.3; build/favicon.ts),
// at the root of dist/, so its path is plain and same-origin. The preview image is the Content's
// (site.yaml's file, else the first image of the first Exhibit), always same-origin; `origin`
// makes it absolute where the build knows the site's origin (build/prerender.ts siteOrigin),
// crawlers resolve nothing relative. The entry names each document's title, description and path,
// so a route is known there and in build/prerender.ts only; /start has a description of its own
// (AC-5.2), the other documents the one line. `previewTitle` is the title link previews show
// (og:title, twitter:title), the Owner's name unless a document has its own: /start does (spec
// Users › "Link previews and crawlers"; ai-review round 1 on #123, finding 1).
type Props = {
  content: Content
  title: string
  description: string
  previewTitle?: string
  path: string
  origin: string
}

export function Meta({
  content,
  title,
  description,
  previewTitle = content.owner.name,
  path,
  origin,
}: Props) {
  const image = `${origin}${content.preview.url}`
  return (
    <>
      <title>{title}</title>
      <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      <meta name="description" content={description} />
      <meta property="og:type" content="website" />
      <meta property="og:title" content={previewTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:image:width" content={String(content.preview.width)} />
      <meta property="og:image:height" content={String(content.preview.height)} />
      {origin !== '' && <meta property="og:url" content={`${origin}${path}`} />}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={previewTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
    </>
  )
}
