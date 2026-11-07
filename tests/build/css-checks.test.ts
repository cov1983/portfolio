import { describe, expect, it } from 'vitest'

import {
  colourLiterals,
  hasColourSchemeQuery,
  hexAndFunctionLiterals,
  tokenDeclarations,
  withoutComments,
} from './css-checks'

describe('colourLiterals', () => {
  it('reports a hex colour in a declaration', () => {
    expect(colourLiterals('.a{color:#fff}')).toEqual(['color: #fff'])
  })

  it('reports a colour function', () => {
    expect(colourLiterals('.a{background:rgb(11 26 42 / 70%)}')).toEqual(['background: rgb('])
  })

  it('reports a named colour', () => {
    expect(colourLiterals('.a{border:1px solid white}')).toEqual(['border: white'])
  })

  it('reports a translucent hex such as a resolved color-mix fallback', () => {
    expect(colourLiterals('.a::backdrop{background:#0b1a2acc}')).toEqual(['background: #0b1a2acc'])
  })

  it("accepts #0000 and #00000000, lightningcss's spelling of transparent", () => {
    expect(colourLiterals('button{background-color:#0000}.b{--tw-shadow:0 0 #00000000}')).toEqual(
      [],
    )
  })

  it('reports a literal inside a media query', () => {
    expect(colourLiterals('@media (hover:hover){.a:hover{color:red}}')).toEqual(['color: red'])
  })

  it('accepts a --color-* token declaration', () => {
    expect(colourLiterals(':root{--color-primary:#168bff;--color-background:#0b1a2a}')).toEqual([])
  })

  it('accepts transparent, currentcolor, inherit and var()', () => {
    expect(
      colourLiterals(
        '.a{color:inherit;background:transparent;border-color:currentcolor;' +
          'outline-color:var(--color-primary);fill:color-mix(in srgb,var(--color-surface) 80%,transparent)}',
      ),
    ).toEqual([])
  })

  it('ignores selectors, strings, url() and comments', () => {
    expect(
      colourLiterals(
        '/* #fff red */a:focus-visible{font-family:"Red Hat";src:url(/assets/white-1a.woff2)}',
      ),
    ).toEqual([])
  })

  it('ignores a --color-* name used inside another value', () => {
    expect(colourLiterals('.a{color:var(--color-foreground)}')).toEqual([])
  })
})

describe('hexAndFunctionLiterals', () => {
  it('finds hex colours and colour functions in a source text, in order', () => {
    expect(hexAndFunctionLiterals('className="bg-[#123456] text-[oklch(0.5_0.1_250)]"')).toEqual([
      '#123456',
      'oklch(',
    ])
  })

  it('accepts a Tailwind token class', () => {
    expect(hexAndFunctionLiterals('className="bg-primary text-primary-foreground"')).toEqual([])
  })
})

describe('withoutComments', () => {
  it('drops line and block comments, so an issue number such as #100 is not read as a colour', () => {
    const source = '// Owner on #100\nconst a = 1 /* #103 */\n{/* #fff */}'
    expect(hexAndFunctionLiterals(withoutComments(source))).toEqual([])
  })

  it('keeps a hex colour in code', () => {
    expect(hexAndFunctionLiterals(withoutComments('className="bg-[#123456]" // #100'))).toEqual([
      '#123456',
    ])
  })

  // ai-review round 1 on #121, finding 3: the regex took any `//` not after a `:` for a comment.
  it('keeps a hex colour after a protocol-relative URL on the same line', () => {
    expect(
      hexAndFunctionLiterals(
        withoutComments('const a = <img src="//x" className="bg-[#123456]" />'),
      ),
    ).toEqual(['#123456'])
  })

  it('keeps a hex colour after a // in JSX text', () => {
    expect(
      hexAndFunctionLiterals(
        withoutComments('const b = <p>a // b <span className="bg-[#654321]" /></p>'),
      ),
    ).toEqual(['#654321'])
  })

  it('keeps a hex colour after a // in a template literal', () => {
    expect(hexAndFunctionLiterals(withoutComments("const c = `${x} // ${'#abcdef'}`"))).toEqual([
      '#abcdef',
    ])
  })

  it('keeps the // of a URL in a string', () => {
    expect(hexAndFunctionLiterals(withoutComments("const u = 'https://example.org/#abc'"))).toEqual(
      ['#abc'],
    )
  })
})

describe('tokenDeclarations', () => {
  it('reports a --color-* token declared in a rule, a scoped override', () => {
    expect(tokenDeclarations('.hint{--color-primary:#ff0000;color:var(--color-primary)}')).toEqual([
      '--color-primary',
    ])
  })

  it('reports a second token set, the palette reset included', () => {
    expect(
      tokenDeclarations(
        '@theme static{--color-*:initial;--color-accent:#ff0000}/* --color-x:red */',
      ),
    ).toEqual(['--color-*', '--color-accent'])
  })

  it('accepts a stylesheet that only reads tokens', () => {
    expect(
      tokenDeclarations('.a{color:var(--color-foreground);--tw-ring-color:var(--color-primary)}'),
    ).toEqual([])
  })
})

describe('hasColourSchemeQuery', () => {
  it('finds a prefers-color-scheme media query', () => {
    expect(hasColourSchemeQuery('@media (prefers-color-scheme: dark){:root{}}')).toBe(true)
  })

  it('accepts a stylesheet without one', () => {
    expect(hasColourSchemeQuery(':root{color-scheme:dark}')).toBe(false)
  })
})
