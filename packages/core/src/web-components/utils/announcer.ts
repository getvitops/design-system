/**
 * One polite live region for the whole page, shared by every `<wc-field>`.
 *
 * Why one, and why not a region per field. A live region announces CHANGES to its text. A
 * per-field error node that is `display: none` while empty is *shown*, not changed, when an error
 * appears, which assistive tech reports unreliably. And when a failed submit makes five fields
 * invalid at once, five regions talk over each other and over the field that just took focus,
 * whose error its own `aria-describedby` already reads. A single region that is created before it
 * is ever written to, and written to a moment after the event, avoids all three.
 *
 * The region is created on first use and kept; nothing is announced until `announce()` is called.
 */

/** How long to wait so the field that receives focus next is announced first. */
export const ANNOUNCE_DELAY_MS = 500;

let region: HTMLElement | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;

/**
 * The region, created now if it does not exist. Call this at upgrade time (before any error can
 * appear) so the node is in the accessibility tree already when the first message is written.
 */
export function ensureAnnouncer(doc: Document = document): HTMLElement {
  if (region?.isConnected) return region;
  const el = doc.createElement('div');
  el.setAttribute('aria-live', 'polite');
  el.setAttribute('data-wc-announcer', '');
  // Inline, not a class: the framework's `.sr-only` is not shipped in every format, and a
  // visually-hidden node must stay in the accessibility tree (so no `display: none`).
  el.style.cssText =
    'position:absolute;inline-size:1px;block-size:1px;margin:-1px;padding:0;overflow:hidden;' +
    'clip-path:inset(50%);white-space:nowrap;border:0;';
  doc.body.append(el);
  region = el;
  return el;
}

/**
 * Announce `text` after a short delay. A newer call replaces a pending one, so a burst of errors
 * collapses to the last rather than queueing a pile of speech.
 */
export function announce(text: string, doc: Document = document): void {
  const el = ensureAnnouncer(doc);
  clearTimeout(timer);
  // Cleared first so an identical message is still a change.
  el.textContent = '';
  timer = setTimeout(() => {
    el.textContent = text;
  }, ANNOUNCE_DELAY_MS);
}

/** Test seam: forget the region and any pending message. */
export function resetAnnouncer(): void {
  clearTimeout(timer);
  region?.remove();
  region = null;
}
