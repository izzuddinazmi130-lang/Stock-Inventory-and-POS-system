import { extendTailwindMerge } from 'tailwind-merge';

// Teach tailwind-merge our custom scale so e.g. `text-caption` (a size) doesn't knock out `text-ink` (a colour).
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['caption', 'table-head'] }],
      shadow: [{ shadow: ['xs', 'card', 'popover', 'modal', 'elevated', 'soft'] }],
      duration: [{ duration: ['fast', 'base', 'slow'] }],
    },
  },
});

/** Join class names (falsy values skipped) and let later Tailwind classes win over earlier ones. */
export function cn(...args) {
  return twMerge(args.flat(Infinity).filter(Boolean).join(' '));
}

/** The one focus style for anything clickable (buttons, links, tabs, rows). */
export const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface';

/** True when the user asked the OS for less motion. */
export function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}
