import type { Content } from '../content/types.ts'

// The head of a pre-rendered document (AC-3.1): rendered to a string by src/entry-prerender.tsx
// and placed at index.html's <!--app-head--> by build/build.ts. The preview image is the
// Content's (site.yaml's file, else the first image of the first Exhibit), always same-origin;
// `origin` makes it absolute where the build knows the site's origin (build/prerender.ts
// siteOrigin), crawlers resolve nothing relative. The entry names each document's title and
// path, so a route is known there and in build/prerender.ts only.
type Props = { content: Content; title: string; path: string; origin: string }

export function Meta({ content, title, path, origin }: Props) {
  const image = `${origin}${content.preview.url}`
  return (
    <>
      <title>{title}</title>
      <meta name="description" content={content.oneLine} />
      <meta property="og:type" content="website" />
      <meta property="og:title" content={content.owner.name} />
      <meta property="og:description" content={content.oneLine} />
      <meta property="og:image" content={image} />
      <meta property="og:image:width" content={String(content.preview.width)} />
      <meta property="og:image:height" content={String(content.preview.height)} />
      {origin !== '' && <meta property="og:url" content={`${origin}${path}`} />}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={content.owner.name} />
      <meta name="twitter:description" content={content.oneLine} />
      <meta name="twitter:image" content={image} />
    </>
  )
}
