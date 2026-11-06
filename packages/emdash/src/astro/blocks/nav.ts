/**
 * Pure decisions behind the `vitops.nav` block, kept out of `Nav.astro` so they are asserted in
 * `nav.test.ts` without rendering (the split `sitenav.ts` makes for `<SiteNav>`). The menu-tree
 * helpers themselves — depth trimming, `aria-current` — are `@getvitops/astro`'s, not copied.
 */

export const NAV_VARIANTS = ['list', 'inline', 'columns', 'sitenav'] as const;
export type NavVariant = (typeof NAV_VARIANTS)[number];

/**
 * An EmDash menu name is a slug. Anything else is refused before it reaches `getMenu()`, so a
 * saved value can never be a path, a query or markup — and a block pointing at "nothing" is
 * the same quiet no-op as one pointing at a menu that was deleted.
 */
export function menuName(input: unknown): string | null {
  const name = typeof input === 'string' ? input.trim() : '';
  return /^[a-z0-9][a-z0-9_-]{0,63}$/i.test(name) ? name : null;
}

export function navVariant(input: unknown): NavVariant {
  return (NAV_VARIANTS as readonly string[]).includes(String(input))
    ? (input as NavVariant)
    : 'list';
}

/** 1–3 levels. A page-body nav that nests deeper is a site map, and wants its own page. */
export function navDepth(input: unknown): 1 | 2 | 3 {
  const n = Math.round(Number(input));
  return n >= 3 ? 3 : n === 2 ? 2 : 1;
}

/**
 * Names the header and footer landmarks already use. `<SiteNav>` is "Primary" and
 * `<SiteFooter>` is "Site map" / "Legal"; a second `<nav aria-label="Primary">` in the page
 * body would leave a screen-reader user a landmark list of identical entries.
 */
const TAKEN = new Set(['primary', 'site map', 'legal', 'main', 'navigation', 'menu']);

/**
 * The accessible name for the block's `<nav>`: the editor's `label`, else the visible
 * `heading`, else the menu's own label, else its name. If that lands on one of the names the
 * layout's header/footer already use, a distinguishing suffix is added rather than shipping
 * two landmarks that read the same.
 */
export function navLabel(
  label: unknown,
  heading: unknown,
  menuLabel: unknown,
  name: string,
): string {
  const pick =
    [label, heading, menuLabel, name]
      .map((v) => (typeof v === 'string' ? v.trim() : ''))
      .find(Boolean) ?? 'Links';
  return TAKEN.has(pick.toLowerCase()) ? `${pick} (this page)` : pick;
}

/** A DOM-id-safe slug, used to keep two `sitenav`-variant blocks' drawer ids apart. */
export function navId(key: unknown, name: string): string {
  const slug = `${typeof key === 'string' && key ? key : name}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `navblock-${slug || 'x'}`;
}
