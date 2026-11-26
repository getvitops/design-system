/**
 * The `reveal` field on Cards, Steps and Stats: a staggered entrance for the items.
 *
 * `.stagger` on a parent only sets `--_stagger-index` on its children — each child still needs
 * an effect and a driver (`fade-in slide-up animate-view`) to animate, and the editor's
 * `className` reaches only the block root. So the block owns both halves: `root` goes on the
 * list (`stagger`) and `item` on every item (effect + scroll-driven driver).
 *
 * The class strings are **literals on purpose**. Under the tailwind format a class exists only
 * if Tailwind sees it in a scanned file, and this file is one (see `sources`); building them from
 * `${effect} animate-view` would hide them from the scanner.
 *
 * The effects are the ones the default design system ships (`fade-in`, `slide-up`); a site whose
 * config renames them can still pick a reveal here, it just animates nothing — the same silent
 * failure as any unknown framework class, which `vitops lint` reports.
 */
export const REVEALS = {
  fade: 'fade-in animate-view',
  slide: 'slide-up animate-view',
  'fade-slide': 'fade-in slide-up animate-view',
} as const;

export type RevealKey = keyof typeof REVEALS;

/** What to add to the block root and each item for an editor's `reveal` choice; empty for none. */
export function reveal(value: unknown): { root: string | undefined; item: string | undefined } {
  const key = typeof value === 'string' ? value : '';
  return Object.hasOwn(REVEALS, key)
    ? { root: 'stagger', item: REVEALS[key as RevealKey] }
    : { root: undefined, item: undefined };
}
