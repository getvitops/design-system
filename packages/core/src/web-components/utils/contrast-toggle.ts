/**
 * What `<wc-contrast-toggle>` should do, separated from the DOM plumbing that does it — the same
 * split as `counter.ts` against `WCCounter`. Everything decidable is a function over plain data
 * here, tested in the default `node` environment.
 *
 * The toggle is WCAG technique G174: a control that switches the page to a conforming
 * high-contrast version. The version itself is CSS (the generator's `[data-contrast="more"]`
 * layer); this only chooses whether it is on.
 */

export type ContrastChoice = 'more' | 'standard';

/**
 * Where the choice is remembered. MUST match the key the pre-paint script in `@getvitops/astro`'s
 * `<Head contrast />` reads (`CONTRAST_SCRIPT`); `head.test.ts` asserts the two stay in step.
 */
export const CONTRAST_STORAGE_KEY = 'vitops-contrast';

/** The consent event, mirrored rather than imported — see `WCColorSchemeToggle`. */
export const CONTRAST_CONSENT_EVENT = 'vitops:consent';

/** A stored value, or null for anything that is not one of the two choices. */
export function readChoice(raw: string | null | undefined): ContrastChoice | null {
  return raw === 'more' || raw === 'standard' ? raw : null;
}

/**
 * Whether the checkbox starts checked. An explicit stored choice wins, in either direction: a
 * visitor whose OS asks for more contrast can still have turned it off here. With no choice, follow
 * the OS, which is also what the CSS media query is doing.
 */
export function initialChecked(stored: ContrastChoice | null, prefersMore: boolean): boolean {
  return stored == null ? prefersMore : stored === 'more';
}

/** The value `data-contrast` takes for a checkbox state. */
export const choiceFor = (checked: boolean): ContrastChoice => (checked ? 'more' : 'standard');

/**
 * Whether to write `data-contrast` on load. Only for an explicit stored choice: with none, the
 * media query already does the right thing and an attribute would be a second, redundant source.
 */
export const shouldApplyOnLoad = (stored: ContrastChoice | null): stored is ContrastChoice =>
  stored != null;
