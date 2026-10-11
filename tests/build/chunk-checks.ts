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
