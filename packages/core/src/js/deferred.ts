// Scroll-driven animation support is feature-detected by animation.css itself
// (`@supports not (animation-timeline: view())`), and whether to pause a trigger
// animation by `@media (scripting: enabled)`. Neither needs a class on <html>, so
// there is nothing for this bundle to flag — and, more to the point, nothing that
// breaks when this bundle never loads.

// Apply stagger delays based on visual row position.
//
// This deliberately OVERRIDES the CSS `sibling-index()` path in animation.css:
// an inline custom property wins, and row-relative is the better semantic for a
// wrapping grid — otherwise the first item of row 2 inherits row 1's accumulated
// delay and arrives late for no visible reason. Both paths are 0-based; the CSS
// one subtracts 1 because sibling-index() counts from 1. Keep them in step.
function applyRowStagger(container: Element): void {
  const items = [...container.children] as HTMLElement[];
  const baseDelay = parseFloat(getComputedStyle(container).getPropertyValue('--stagger-amount'));
  const rows: { top: number; items: HTMLElement[] }[] = [];
  const containerTop = container.getBoundingClientRect().top;

  // Group items by their visual vertical position (same row)
  // Uses getBoundingClientRect for accurate visual position regardless of margins
  items.forEach((item) => {
    const top = Math.round(item.getBoundingClientRect().top - containerTop);
    // Find existing row within 10px tolerance
    let row = rows.find((r) => Math.abs(r.top - top) < 10);
    if (!row) {
      row = { top, items: [] };
      rows.push(row);
    }
    row.items.push(item);
  });

  // Apply stagger index based on position within each row
  rows.forEach(({ items: rowItems }) => {
    rowItems.forEach((item: HTMLElement, i: number) => {
      item.style.setProperty('--_stagger-index', String(i));
    });
  });
}

// Recalculate on resize
let resizeTimeout: ReturnType<typeof setTimeout> | undefined;
function handleResize(): void {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    requestAnimationFrame(() => {
      document.querySelectorAll('.stagger').forEach(applyRowStagger);
    });
  }, 100);
}

/**
 * Adds `.is-active` when an element's MIDPOINT is 10% of the viewport in.
 *
 * That threshold matches `.animate-view`'s default range in animation.css, so a
 * `.animate-trigger` and a scroll-driven element on the same page start at the
 * same moment on screen — and it's the element's position, not a fraction of its
 * own size, so a 4rem card and a full-bleed section behave alike.
 *
 * `.is-active` also drives the `active-<fx>` transition variants, so this one
 * observer times both the keyframe and the transition families.
 *
 * Two things it must not do:
 *   • fire on a sliver. rootMargin alone (bottom -10%) triggers as soon as the
 *     leading EDGE crosses, which for a tall section is most of a screen too
 *     early — hence the explicit midpoint test.
 *   • never fire. A threshold of 0.5 would express "midpoint in" directly, but an
 *     element taller than the (shrunk) root can never be 50% visible, so it would
 *     stay hidden forever — a content-loss bug, not a missing animation. The test
 *     is geometric instead, and the threshold list only exists to guarantee the
 *     callback runs often enough to catch the crossing.
 */
/** Percent of the viewport the midpoint must clear. Mirrors `10vh` in animation.css. */
const TRIGGER_INSET_PCT = 10;

const triggerObserver = new IntersectionObserver(
  (entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const root = entry.rootBounds;
      const box = entry.boundingClientRect;
      // rootBounds is null for a cross-origin root we can't measure. The element
      // is intersecting, so play — withholding content is the worse failure.
      // An element taller than the root falls back to its leading edge: its
      // midpoint reaching the line can lag most of a screen behind, and waiting
      // for it would leave a full-height section hidden while it fills the
      // viewport. `isIntersecting` already means that edge has crossed.
      const reached = !root || box.height >= root.height || box.top + box.height / 2 <= root.bottom;
      if (!reached) return;
      (entry.target as HTMLElement).classList.add('is-active');
      observer.unobserve(entry.target);
    });
  },
  {
    // The margin shrinks the root, so `rootBounds.bottom` above is already the
    // 15%-in line. The threshold list buys nothing on its own — it just makes the
    // callback run often enough to catch the midpoint crossing, which no single
    // threshold expresses.
    rootMargin: `0px 0px -${TRIGGER_INSET_PCT}% 0px`,
    threshold: [0, 0.25, 0.5, 0.75, 1],
  },
);

// Set horizontal-scroll track width to match its content
function setHorizontalScrollTrackWidth(container: Element): void {
  const track = container.querySelector('.horizontal-scroll__track');
  if (!track) return;

  // Sum the widths of all direct children
  const contentWidth = Array.from(track.children).reduce((total, child) => {
    return total + (child as HTMLElement).offsetWidth;
  }, 0);

  (track as HTMLElement).style.width = `${contentWidth}px`;
}

// Close open dialogs when clicking same-document fragment links inside them
document.addEventListener('click', (e) => {
  const link = (e.target as Element).closest?.('a[href^="#"]');
  if (!link) return;
  const dialog = link.closest('dialog[open]');
  if (dialog) (dialog as HTMLDialogElement).close();
});

// we use load and an rAF to ensure all styles and layouts are settled first.
// these operations can cause forced reflows if done too early.
window.addEventListener('load', () => {
  requestAnimationFrame(() => {
    // Apply row-based stagger to all stagger containers (deferred to avoid forced reflow)
    document.querySelectorAll('.stagger').forEach(applyRowStagger);
    window.addEventListener('resize', handleResize);

    // Set horizontal scroll track widths
    document.querySelectorAll('.horizontal-scroll').forEach(setHorizontalScrollTrackWidth);

    // Observe .animate-trigger elements
    document.querySelectorAll('.animate-trigger').forEach((el) => {
      triggerObserver.observe(el);
    });

    // Update all current year elements
    const currentYear = new Date().getFullYear();
    document.querySelectorAll('[data-current-year]').forEach((el) => {
      el.textContent = currentYear.toString();
    });
  });
});
