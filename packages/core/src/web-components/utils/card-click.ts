/**
 * Should this interaction navigate the card?
 *
 * The decision, separated from the DOM plumbing that feeds it — the same split as
 * `tree-filter.ts` against `WCTree`. Everything genuinely decidable is a function
 * over plain data here, tested in the default `node` environment; `WCCards` only
 * gathers the inputs and acts on the answer.
 *
 * The whole reason this element exists is that CSS cannot make a whole card
 * clickable *and* leave its text selectable: an overlay (`.stretched-link`)
 * necessarily receives the pointer-drag, so selection dies wherever it covers. With
 * no overlay the text selects normally, and the only question left is the one below
 * — telling a click apart from the end of a drag.
 */

/** The interaction, reduced to what the decision actually depends on. */
export interface CardClick {
  /** Distance the pointer travelled between press and release, in CSS pixels. */
  moved: number;
  /**
   * Whether the press landed inside something that already handles clicks —
   * another link, a button, a form control, a `<summary>`, editable text.
   */
  onInteractive: boolean;
  /** `ctrl`/`cmd`/`shift`/`alt` held, or a non-primary button (middle, right). */
  platformHandled: boolean;
  /** Whether the card was found to contain a real link to forward to. */
  hasLink: boolean;
}

/**
 * How far the pointer may travel and still count as a click, in CSS pixels.
 *
 * A press-and-release never lands on exactly the same pixel — a trackpad tap
 * routinely moves 1–3px — so zero would make the card unclickable for some people.
 * Above roughly this distance the intent is a drag, which for text is a selection.
 */
export const DRAG_THRESHOLD = 6;

/**
 * Decide whether to forward the interaction to the card's link.
 *
 * Deliberately conservative: every uncertain case resolves to "do nothing", which
 * leaves the visitor with the real link they could already use. The failure mode of
 * a false negative is a click that did not follow a shortcut; of a false positive,
 * a navigation that threw away a selection the visitor was making, or hijacked a
 * control. Those are not equally bad.
 */
export function shouldNavigate(click: CardClick): boolean {
  // Nothing to forward to. The card has no link, so there is no shortcut to offer.
  if (!click.hasLink) return false;
  // Already interactive: that element's own behaviour is the correct one, and this
  // must not double-handle it.
  if (click.onInteractive) return false;
  // The platform is about to do something better with this (open in a new tab or
  // window, show a context menu). Forwarding on top would duplicate or fight it.
  if (click.platformHandled) return false;
  // A drag. For text, that is a selection — the requirement this element exists to
  // preserve, so it wins over the convenience.
  return click.moved <= DRAG_THRESHOLD;
}

/** Selectors for content whose clicks belong to the content, not to the card. */
export const INTERACTIVE = [
  'a[href]',
  'button',
  'input',
  'select',
  'textarea',
  'label',
  'summary',
  'details',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]',
  '[role="button"]',
  '[role="link"]',
  '[onclick]',
  '[data-no-card-link]',
].join(',');

/** Pointer travel between two points, for `moved`. */
export function distance(from: { x: number; y: number }, to: { x: number; y: number }): number {
  return Math.hypot(to.x - from.x, to.y - from.y);
}
