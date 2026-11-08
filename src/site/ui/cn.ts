import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// shadcn/ui's `cn`, copied by hand (ADR 0017): clsx joins the conditional classes, tailwind-merge
// resolves conflicting utilities so the last one wins (a caller's className over a default).
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
