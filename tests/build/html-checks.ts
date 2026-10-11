// Pure checks on built HTML for the `build` Vitest project (plan §6, seam 1's build half). Text
// matching, no DOM: the build output is Vite's own markup, so an open tag never spans a quoted `>`.

const OPEN_TAG = /<([a-z][\w-]*)\b([^>]*)>/gi
const SRC_ATTRIBUTE = /(^|\s)src\s*=/i
const STYLE_ATTRIBUTE = /(^|\s)style\s*=/i
const NONCE_ATTRIBUTE = /(^|\s)nonce\s*=/i

type OpenTag = { raw: string; name: string; attributes: string }

function openTags(html: string): OpenTag[] {
  return [...html.matchAll(OPEN_TAG)].map((match) => ({
    raw: match[0],
    name: (match[1] ?? '').toLowerCase(),
    attributes: match[2] ?? '',
  }))
}

function rawTags(html: string, keep: (tag: OpenTag) => boolean): string[] {
  return openTags(html)
    .filter(keep)
    .map((tag) => tag.raw)
}

/** Every `<script>` open tag without a `src` attribute, i.e. an inline script the CSP would block. */
export function inlineScripts(html: string): string[] {
  return rawTags(html, (tag) => tag.name === 'script' && !SRC_ATTRIBUTE.test(tag.attributes))
}

/** Every open tag carrying a `style` attribute, which `style-src 'self'` blocks. */
export function styleAttributes(html: string): string[] {
  return rawTags(html, (tag) => STYLE_ATTRIBUTE.test(tag.attributes))
}

/** Every open tag carrying a `nonce` attribute: the dev-only nonce of vite.config.ts must never be built in. */
export function nonceAttributes(html: string): string[] {
  return rawTags(html, (tag) => NONCE_ATTRIBUTE.test(tag.attributes))
}
