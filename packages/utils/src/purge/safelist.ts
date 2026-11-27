/**
 * What a CSS purge must never drop, in one place.
 *
 * A purge only sees markup that exists at build time. Everything here is state that appears later
 * (a toggle, a web component, the browser, a polyfill), so a rule keyed on it has no match in the
 * built HTML and would be deleted. `safelist.test.ts` fails when `@getvitops/core`'s CSS gains a
 * `data-*` or `aria-*` attribute selector that is not listed, so a new state rule cannot ship
 * unprunable by accident.
 */

/**
 * Attributes whose value is set at runtime, so selectors on them survive whatever the HTML says.
 *
 * - `data-contrast` is the contrast toggle and `:root[data-contrast=more]` is an accessibility
 *   override, never optional; `data-theme` is the colour-scheme toggle.
 * - `href` keeps `[href=\#anchor]`: after minification the escaped `\#` never matches page text.
 * - `dir` / `lang` are RTL and locale switches.
 */
export const DYNAMIC_ATTRIBUTES = [
  'open',
  'hidden',
  'inert',
  'popover',
  'dir',
  'lang',
  'href',
  'running',
  'part',
  'data-active',
  'data-blank',
  'data-card-link',
  'data-carousel-clone',
  'data-consent',
  'data-consent-save',
  'data-contrast',
  'data-depth',
  'data-dismiss',
  'data-invalid',
  'data-numeric',
  'data-open',
  'data-paused',
  'data-pinned',
  'data-raised',
  'data-repeat-action',
  'data-scrolled',
  'data-state',
  'data-step',
  'data-theme',
  'data-tone',
  'data-tree-keyboard',
  'data-vitops-activated',
  'aria-busy',
  'aria-current',
  'aria-disabled',
  'aria-expanded',
  'aria-hidden',
  'aria-invalid',
  'aria-pressed',
  'aria-selected',
] as const;

export const SAFELIST = {
  /** Prefix families that are state, not authored: `is-active`, `has-nav`, `<wc-*>`, `astro-*` scopes. */
  greedy: [/^is-/, /^has-/, /^wc-/, /^astro-/],
  /**
   * `.\:popover-open` is the polyfill's stand-in for `:popover-open`. PurgeCSS requires every class
   * in a selector to exist on a page, so without this every `:is(:popover-open, .\:popover-open)`
   * rule (mobile drawer, nav panels, masthead states) is dropped.
   */
  standard: [/^:popover-open$/],
} as const;

/** Class names plus the characters template literals and attribute values are built from. */
export function extractor(content: string): string[] {
  return content.match(/[A-Za-z0-9_:/@%.\-[\]]+/g) ?? [];
}
