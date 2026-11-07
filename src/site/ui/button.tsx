import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'

import { cn } from './cn'

// shadcn/ui's Button, copied by hand into the repository, not used as a package (ADR 0017; spec
// increment-2, Implementation decisions › Design system). Changed from the original:
// - no `asChild`: it needs Radix's Slot (`radix-ui`, T3b's dependency); a link stays an anchor;
// - no focus-halo or elevation utilities: Tailwind gives them transparent and white initial
//   values, colour literals outside the token layer; focus is the site's own outline in the
//   accent (site.css base layer), which the keyboard specs read;
// - no transition or animation classes: the look has exactly two effects (spec AC-1.2, D6), and
//   reduced motion has nothing to switch off here;
// - no opacity modifier on a colour utility: Tailwind's optimizer resolves it into a hex literal
//   outside the token layer; hover brightens with a filter instead;
// - the variants are not exported, so this file exports components only (react-refresh) and,
//   being *.tsx, stays outside the coverage ratchet: rendering is proven by the Playwright seam.
// Tailwind's scanner reads this comment too: a word here that names a utility generates it, so the
// comment names none (tests/build/tokens.test.ts caught the first draft doing so).
const buttonVariants = cva(
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg font-semibold whitespace-nowrap disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        /** Filled: navy ink on the accent (white on it is 3.4:1, tokens.css). */
        default: 'bg-primary text-primary-foreground hover:brightness-110',
        /** Outlined: the surface with an accent edge, for a control over the World. */
        outline: 'border-2 border-primary bg-surface text-foreground hover:bg-background',
      },
      size: {
        default: 'px-6 py-3 text-base',
        sm: 'px-4 py-2 text-base',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

type Props = ComponentProps<'button'> & VariantProps<typeof buttonVariants>

export function Button({ className, variant, size, type = 'button', ...props }: Props) {
  return (
    <button
      type={type}
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
}
