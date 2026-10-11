// Pure checks on built HTML for the `build` Vitest project (plan §6, seam 1's build half). Text
// matching, no DOM: the build output is Vite's own markup, so an open tag never spans a quoted `>`.

const OPEN_TAG = /<([a-z][\w-]*)\b([^>]*)>/gi
const SRC_ATTRIBUTE = /(^|\s)src\s*=/i
const STYLE_ATTRIBUTE = /(^|\s)style\s*=/i

function openTags(html: string): { name: string; attributes: string }[] {
  return [...html.matchAll(OPEN_TAG)].map((match) => ({
    name: (match[1] ?? '').toLowerCase(),
    attributes: match[2] ?? '',
  }))
}

/** Every `<script>` open tag without a `src` attribute, i.e. an inline script the CSP would block. */
export function inlineScripts(html: string): string[] {
  return openTags(html)
    .filter((tag) => tag.name === 'script' && !SRC_ATTRIBUTE.test(tag.attributes))
    .map((tag) => `<script${tag.attributes}>`)
}

/** Every open tag carrying a `style` attribute, which `style-src 'self'` blocks. */
export function styleAttributes(html: string): string[] {
  return openTags(html)
    .filter((tag) => STYLE_ATTRIBUTE.test(tag.attributes))
    .map((tag) => `<${tag.name}${tag.attributes}>`)
}
