// Pure checks on built chunks for the `build` Vitest project (plan §7, ADR 0010). Text matching on
// Vite's own output: no parser.

const SCRIPT_SRC = /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi
// A static `import … from "x"`, `import "x"` or `export … from "x"`: the bindings part never holds a
// quote, a paren or a semicolon, so a dynamic `import("x")` and `import.meta` never match.
const STATIC_IMPORT = /\b(?:import|export)\s*(?:[^;'"()]*?\s*from\s*)?["']([^"']+)["']/g

/** The `src` of every script tag, in document order. */
export function scriptSources(html: string): string[] {
  return [...html.matchAll(SCRIPT_SRC)].map((match) => match[1] ?? '')
}

/** The specifiers of every static import or re-export in a chunk, in source order. */
export function staticImports(js: string): string[] {
  return [...js.matchAll(STATIC_IMPORT)].map((match) => match[1] ?? '')
}

// A `data:` URL as a bundler inlines an asset under its inline limit (Vite: build.assetsInlineLimit,
// 4 KiB by default): the scheme, a media type and the comma before the payload. A regex literal such
// as three's `data:(.*?)` or prose with "data:" has no media type and never matches.
const DATA_URL = /\bdata:[a-z][a-z0-9.+-]*\/[a-z0-9.+-]+(?:;[a-z0-9=-]+)*,/gi

/** Every `data:` URL (scheme, media type, parameters and the comma) in a chunk or stylesheet, in source order. */
export function dataUrls(text: string): string[] {
  return [...text.matchAll(DATA_URL)].map((match) => match[0])
}
