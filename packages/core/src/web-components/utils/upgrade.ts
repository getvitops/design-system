/**
 * Upgrade timing for light-DOM components.
 *
 * Every tier-2 element here parses its slotted markup and augments it in place, so
 * all of them depend on that markup existing when they initialise. Usually it
 * does: `elements.js` is a deferred module, so the document is fully parsed before
 * any definition registers, and `connectedCallback` sees a complete subtree.
 *
 * But an element upgraded **during** insertion is connected before its children
 * exist. Measured in happy-dom, and true in browsers for the same reason:
 *
 *   document.body.innerHTML = '<wc-entries><h3>a</h3><dl>…</dl></wc-entries>';
 *   // → connectedCallback runs with zero children
 *
 * That happens on an Astro view-transition swap, a client-side navigation, any
 * `innerHTML` write, and anything that clones a template. The failure is silent:
 * the element early-returns because it found nothing to enhance, and what is left
 * on screen is the un-upgraded fallback with no error anywhere.
 *
 * So initialisation is expressed as a function that reports whether it found its
 * markup, and is retried once the insertion has finished.
 */

/**
 * Run `setup` now; if it reports it had nothing to work with, run it once more
 * after the current task, by which time a synchronous insertion has completed.
 *
 * `setup` must return `true` once it has initialised and must be safe to call
 * twice — guard it with a flag if it generates DOM, or a retry after a genuine
 * empty state will duplicate whatever it appended.
 *
 * Two retries, not a poll. The first is a microtask, which covers markup that
 * lands in the same task (an `innerHTML` write). The second only exists while the
 * document is still being parsed: an element can be defined by an inline module
 * or an early `import` before the parser has reached its children, and the HTML
 * parser can yield mid-subtree, so a microtask later is still too early. Waiting
 * for `DOMContentLoaded` is the point at which every child of a parsed element
 * is guaranteed to exist. A subtree that arrives after that is a different
 * problem and wants a `MutationObserver` at the call site, not a busy-wait here.
 */
export function initFromLightDom(el: HTMLElement, setup: () => boolean): void {
  if (setup()) return;
  queueMicrotask(() => {
    if (!el.isConnected || setup()) return;
    if (el.ownerDocument.readyState !== 'loading') return;
    el.ownerDocument.addEventListener(
      'DOMContentLoaded',
      () => {
        if (el.isConnected) setup();
      },
      { once: true },
    );
  });
}
