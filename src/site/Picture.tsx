import type { ImageSet } from '../content/types.ts'

// One Exhibit image as the build serves it (AC-27.1): AVIF and WebP at three widths, the
// PNG/JPEG fallback at the largest; never the original file. Lazy: the Fallback Page lists every
// Exhibit, the Panel (T6) opens one.
type Props = { image: ImageSet }

export function Picture({ image }: Props) {
  return (
    <picture>
      {image.sources.map((source) => (
        <source key={source.type} type={source.type} srcSet={source.srcset} sizes={image.sizes} />
      ))}
      <img
        src={image.fallback}
        width={image.width}
        height={image.height}
        alt={image.alt}
        loading="lazy"
        decoding="async"
      />
    </picture>
  )
}
