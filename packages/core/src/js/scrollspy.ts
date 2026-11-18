/**
 * Scrollspy for engines without `scroll-target-group` (everything but Chromium today): marks the
 * link of the section being read with `.is-current` and `aria-current="location"`, which
 * `patterns/scroll-target.css` styles exactly as it does `:target-current`. Loaded only by
 * `polyfills.ts` when the feature is missing, so Chromium pays nothing.
 *
 * Applies to `.scroll-target-group` and `.toc-sidebar` containers. An IntersectionObserver is
 * the trigger (no scroll listener); the decision itself is `currentIndex`.
 */
import { currentIndex } from '../web-components/utils/scrollspy.ts';

const SELECTOR = '.scroll-target-group, .toc-sidebar';

function headerOffset(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--header-offset');
  const probe = document.createElement('div');
  probe.style.cssText = `position:absolute;visibility:hidden;block-size:${raw.trim() || '0px'}`;
  document.body.append(probe);
  const px = probe.getBoundingClientRect().height;
  probe.remove();
  return px + 16;
}

function bind(root: Element): () => void {
  const links = [...root.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')];
  const pairs = links.flatMap((link) => {
    const id = decodeURIComponent(link.hash.slice(1));
    const target = id ? document.getElementById(id) : null;
    return target ? [{ link, target }] : [];
  });
  if (pairs.length === 0) return () => {};

  let active = -1;
  const update = () => {
    const atBottom =
      Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight - 2;
    const next = currentIndex(
      pairs.map((p) => p.target.getBoundingClientRect().top),
      headerOffset(),
      atBottom,
    );
    if (next === active) return;
    active = next;
    pairs.forEach(({ link }, i) => {
      link.classList.toggle('is-current', i === next);
      if (i === next) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  };

  const io = new IntersectionObserver(update, { threshold: [0, 1] });
  pairs.forEach((p) => io.observe(p.target));
  update();
  return () => io.disconnect();
}

/** Bind every table of contents on the page. Returns a function that unbinds them. */
export function initScrollspy(): () => void {
  const stops = [...document.querySelectorAll(SELECTOR)].map(bind);
  return () => stops.forEach((stop) => stop());
}
