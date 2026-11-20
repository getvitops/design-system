/**
 * Scroll states — the one vocabulary for "how a thing looks at each scroll state", shared by every
 * scroll-aware pattern (the masthead, `.scroll-edges`, …) so a new pattern adds no new words.
 *
 * A pattern has a SETTLED look (its base rules) and may override parts of it per state. Overrides
 * are custom properties named `--<pattern>-<state>-<prop>` (state in kebab-case, e.g.
 * `--masthead-at-start-height`), which the pattern's partial reads inside the matching
 * `scroll-state()` container query. States only ever override: where the query is unsupported
 * (Firefox today) nothing applies and the settled look stays, which is always a readable one.
 *
 * Order is precedence: when several states hold at once, the LATER one wins.
 *
 * The CSS partials are hand-written to these queries; `scroll-states.test.ts` fails when one stops
 * using the query its state names.
 */
export const SCROLL_STATES = ['atStart', 'atEnd', 'scrollingToEnd', 'scrollingToStart'] as const;
export type ScrollState = (typeof SCROLL_STATES)[number];
export type ScrollAxis = 'block' | 'inline';

/** `atStart` → `at-start`: the spelling used in custom-property names. */
export function scrollStateSlug(state: ScrollState): string {
  return state.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

/** What each state means, for docs. */
export const SCROLL_STATE_MEANING: Record<ScrollState, string> = {
  atStart: 'Nothing is scrolled before the viewport (scrollY = 0 for the page).',
  atEnd: 'Nothing is left to scroll after the viewport.',
  scrollingToEnd: 'The last scroll moved toward the end (down the page).',
  scrollingToStart: 'The last scroll moved back toward the start (up the page).',
};

/** The `scroll-state()` container condition for a state on an axis. */
export function scrollStateQuery(state: ScrollState, axis: ScrollAxis = 'block'): string {
  switch (state) {
    case 'atStart':
      return `not scroll-state(scrollable: ${axis}-start)`;
    case 'atEnd':
      return `not scroll-state(scrollable: ${axis}-end)`;
    case 'scrollingToEnd':
      return `scroll-state(scrolled: ${axis}-end)`;
    case 'scrollingToStart':
      return `scroll-state(scrolled: ${axis}-start)`;
  }
}
