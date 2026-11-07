// Pure checks on stylesheets and sources for the `build` Vitest project (AC-1.1, plan §6 row 1.1).
// Text matching, no CSS parser: the emitted CSS is Vite's and Tailwind's own minified output.
//
// A colour literal is a hex colour, a colour function or a CSS named colour. The keywords
// `transparent`, `currentcolor` and `inherit` carry no hue of their own and are not literals
// (Tailwind's preflight uses all three), and neither is `#0000` or `#00000000`, which is how
// Tailwind's optimizer (lightningcss) minifies `transparent`; any other hex is a literal. A
// `--color-*` declaration is the token layer, the one place a literal may stand.

import ts from 'typescript'

const HEX = /#[0-9a-f]{3,8}\b/gi
/** lightningcss's spelling of `transparent`: zero alpha, no colour. */
const TRANSPARENT_HEX = new Set(['#0000', '#00000000'])
const COLOUR_FUNCTION = /\b(?:rgba?|hsla?|hwb|oklch|oklab|lab|lch|color)\(/gi

// CSS Color 4 named colours (https://www.w3.org/TR/css-color-4/#named-colors), `transparent` excluded.
const NAMED_COLOURS = new Set(
  (
    'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet ' +
    'brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan ' +
    'darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta ' +
    'darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue ' +
    'darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey ' +
    'dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray ' +
    'green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush ' +
    'lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray ' +
    'lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray ' +
    'lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon ' +
    'mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue ' +
    'mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin ' +
    'navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen ' +
    'paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple ' +
    'red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue ' +
    'slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise ' +
    'violet wheat white whitesmoke yellow yellowgreen'
  ).split(' '),
)

// A declaration: a property, a colon, a value up to `;` or `}`, opened right after `{` or `;`. A
// selector with a pseudo-class (`a:hover{`) ends in `{`, so it never matches.
const DECLARATION = /(?<=[{;])\s*(-{0,2}[\w-]+)\s*:\s*([^;{}]+)(?=[;}])/g
const TOKEN_PROPERTY = /^--color-/
// A token declared: `--color-<name>` or the palette reset `--color-*`, opened right after `{` or `;`.
const TOKEN_DECLARATION = /(?<=[{;])\s*(--color-[\w*-]*)\s*:/g
// Strings and url() hold names and paths, never a colour of the page.
const STRINGS_AND_URLS = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\burl\([^)]*\)/gi
const COMMENTS = /\/\*[\s\S]*?\*\//g

/** Hex colours and colour functions in a text, in source order. */
export function hexAndFunctionLiterals(text: string): string[] {
  return [...text.matchAll(HEX), ...text.matchAll(COLOUR_FUNCTION)]
    .sort((a, b) => a.index - b.index)
    .map((match) => match[0])
}

/**
 * A component's source without its comments, for a literal search that reads only code: issue
 * numbers such as #100 are valid 3-digit hex colours. TypeScript's parser reads the source and its
 * printer writes it back without comments, so a `//` in a string, in JSX text or in a template
 * literal stays code (a bare `ts.createScanner` takes the last two for comments, since only the
 * parser tells it when it is inside JSX text or a template; ai-review round 1 on #121, finding 3).
 * The printer's quotes and layout may differ from the source; its literals do not.
 */
export function withoutComments(source: string, fileName = 'source.tsx'): string {
  const kind = fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, false, kind)
  return ts.createPrinter({ removeComments: true }).printFile(file)
}

/** Every named colour word in a CSS value. */
function namedColours(value: string): string[] {
  return (value.toLowerCase().match(/[a-z]+/g) ?? []).filter((word) => NAMED_COLOURS.has(word))
}

/**
 * Every colour literal in a stylesheet outside the `--color-*` declarations of the token layer,
 * each as `property: literal`, in source order.
 */
export function colourLiterals(css: string): string[] {
  const text = css.replace(COMMENTS, '')
  const found: string[] = []
  for (const match of text.matchAll(DECLARATION)) {
    const property = match[1] ?? ''
    if (TOKEN_PROPERTY.test(property)) continue
    const value = (match[2] ?? '').replace(STRINGS_AND_URLS, '')
    const literals = hexAndFunctionLiterals(value).filter(
      (literal) => !TRANSPARENT_HEX.has(literal),
    )
    for (const literal of [...literals, ...namedColours(value)]) {
      found.push(`${property}: ${literal}`)
    }
  }
  return found
}

/**
 * Every `--color-*` declaration in a stylesheet, by property, in source order: in src/site/ the
 * token layer is tokens.css alone, so one anywhere else (a scoped override, a second token set) is
 * a colour that bypasses the one token set even though `colourLiterals` accepts it.
 */
export function tokenDeclarations(css: string): string[] {
  return [...css.replace(COMMENTS, '').matchAll(TOKEN_DECLARATION)].map((match) => match[1] ?? '')
}

/** Whether a stylesheet or source mentions `prefers-color-scheme` (AC-1.1: no light variant). */
export function hasColourSchemeQuery(text: string): boolean {
  return /prefers-color-scheme/i.test(text)
}
