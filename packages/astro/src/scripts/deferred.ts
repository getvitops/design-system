// Apply stagger delays based on visual row position
function applyRowStagger(container: Element): void {
  const items = [...container.children] as HTMLElement[];
  const baseDelay = parseFloat(getComputedStyle(container).getPropertyValue('--stagger-amount'));
  const rows: { top: number; items: HTMLElement[] }[] = [];
  const containerTop = container.getBoundingClientRect().top;

  // Group items by their visual vertical position (same row)
  // Uses getBoundingClientRect for accurate visual position regardless of margins
  items.forEach(item => {
    const top = Math.round(item.getBoundingClientRect().top - containerTop);
    // Find existing row within 10px tolerance
    let row = rows.find(r => Math.abs(r.top - top) < 10);
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

// Observer for .anim-trigger elements - adds .triggered when element enters viewport
const triggerObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      (entry.target as HTMLElement).classList.add('triggered');
      observer.unobserve(entry.target);
    }
  });
});

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

// Show/hide popovers on hover for dropdown/split-link menus
document.querySelectorAll('.dropdown--show-on-hover, .split-link--show-on-hover').forEach(container => {
  const popover = container.querySelector('[popover]') as HTMLElement | null;
  if (!popover) return;

  container.addEventListener('pointerenter', () => {
    popover.showPopover();
  });

  container.addEventListener('pointerleave', () => {
    popover.hidePopover();
  });
});

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

    // Observe .anim-trigger elements
    document.querySelectorAll('.anim-trigger').forEach(el => {
      triggerObserver.observe(el);
    });

    // Update all current year elements
    const currentYear = new Date().getFullYear();
    document.querySelectorAll('[data-current-year]').forEach(el => {
      el.textContent = currentYear.toString();
    });
  });
});
