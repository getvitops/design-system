/**
 * Where focus should go when the element that holds it is about to be removed.
 *
 * Removing a focused node drops focus to `<body>`, so a keyboard user who dismissed a banner
 * with Enter finds their place in the page gone and starts again from the top. The rule is to
 * move it to a logical neighbour *before* the removal, while document order can still be read.
 *
 * Neighbour, not trigger: a dismissable's close control lives inside it, so there is no separate
 * trigger to return to. The next focusable after the removed subtree is where the reading flow
 * continues; failing that, the nearest one before it.
 */

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable=""]',
  '[contenteditable="true"]',
].join(',');

function isReachable(el: HTMLElement): boolean {
  if (el.hidden || el.closest('[inert], [hidden]:not([hidden="until-found"])')) return false;
  // `checkVisibility` is the platform's answer for display:none / visibility:hidden ancestors.
  // Where it is missing, trust the checks above rather than refuse every candidate.
  return el.checkVisibility ? el.checkVisibility({ visibilityProperty: true }) : true;
}

/**
 * The element to focus after `removed` leaves the document, or `null` if none qualifies (in which
 * case leaving focus where the browser puts it is the honest outcome).
 */
export function focusTargetAfterRemoval(removed: Element): HTMLElement | null {
  const doc = removed.ownerDocument;
  let before: HTMLElement | null = null;
  for (const el of doc.querySelectorAll<HTMLElement>(FOCUSABLE)) {
    if (removed.contains(el) || !isReachable(el)) continue;
    const position = removed.compareDocumentPosition(el);
    if (position & Node.DOCUMENT_POSITION_FOLLOWING) return el;
    if (position & Node.DOCUMENT_POSITION_PRECEDING) before = el;
  }
  return before;
}
