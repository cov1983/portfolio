import { describe, expect, it } from 'vitest'

import { cn } from './cn'

// The class composition of the copied shadcn/ui components (ADR 0017): conditional classes are
// joined, and a later utility overrides an earlier one of the same property, so a caller's
// className wins over a component's default.
describe('cn', () => {
  it('lets a later utility override an earlier one of the same property', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4')
  })

  it('drops false, null and undefined parts', () => {
    expect(cn('way-in', false, null, undefined, 'mt-8')).toBe('way-in mt-8')
  })
})
